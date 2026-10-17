import { expect, it } from "vitest";
import { z } from "zod";
import {
  defineErrors,
  createErrorRegistry,
  fromThrown,
  resolveUserMessage,
  errorRegistry,
  errorResponseSchema,
} from "@overmind/contracts";
import { toErrorResponse } from "./to-error-response.ts";

const catalogue = defineErrors("gateway", {
  denied: {
    http: 403,
    severity: "warn",
    retryable: false,
    messageKey: "errors:gateway.denied",
    defaultMessage: "Access was denied.",
    telegramSafe: false,
    audit: true,
    detailsSchema: z.strictObject({ count: z.number().int().nonnegative() }),
  },
});
const registry = createErrorRegistry([{ source: "gateway.errors.ts", errors: catalogue }]);

it("serializes every built-in code into a valid UI and Telegram envelope", async () => {
  for (const code of Object.keys(errorRegistry)) {
    for (const channel of ["ui", "telegram"] as const) {
      const response = toErrorResponse(
        { code, message: "ignored foreign detail" },
        { correlationId: "request-456", channel },
      );
      const wire: unknown = await new Response(JSON.stringify(response.body)).json();
      expect(errorResponseSchema.safeParse(wire).success).toBe(true);
      expect(response.body.error.code).toBe(code);
      expect(JSON.stringify(wire)).not.toContain("foreign");
    }
  }
});

it.each([400, 401, 403, 404, 409, 412, 422, 423, 429, 500, 502, 503])(
  "preserves the registered status %i",
  (http) => {
    const errors = defineErrors("gateway", {
      test_status: {
        ...catalogue.denied.definition,
        http,
        messageKey: "errors:gateway.test_status",
      },
    });
    const localRegistry = createErrorRegistry([{ source: "gateway.errors.ts", errors }]);
    expect(
      toErrorResponse(errors.test_status({ count: 1 }), {
        correlationId: "request",
        registry: localRegistry,
      }).status,
    ).toBe(http);
  },
);

it("drops invalid details with a static diagnostic and never invokes hostile getters", () => {
  const diagnostics: unknown[] = [];
  const response = toErrorResponse(
    { code: "gateway.denied", details: { count: "bad" } },
    {
      correlationId: "request",
      registry,
      logger: {
        warn: (message, fields) => {
          diagnostics.push({ message, fields });
        },
      },
    },
  );
  expect(response.body.error).not.toHaveProperty("details");
  expect(diagnostics).toEqual([
    {
      message: "Invalid error details were dropped.",
      fields: { code: "internal.invalid_error_details", errorCode: "gateway.denied" },
    },
  ]);
  const hostile = Object.defineProperty({}, "code", {
    get() {
      throw new Error("must not be called");
    },
  });
  expect(toErrorResponse(hostile, { correlationId: "request" }).status).toBe(500);
});

it("maps a registered error to the transport status, safe message and request correlation", () => {
  const error = catalogue.denied({ count: 2 });
  const response = toErrorResponse(error, { correlationId: "request-123", registry });
  expect(response).toEqual({
    status: 403,
    body: {
      ok: false,
      error: {
        code: "gateway.denied",
        message: "Access was denied.",
        details: { count: 2 },
        retryable: false,
        correlationId: "request-123",
        userMessage: { key: "errors:gateway.denied", params: { count: 2 } },
      },
    },
  });
  expect(resolveUserMessage(error, "telegram", registry)).toEqual({
    key: "errors:generic.try_again_on_desktop",
    params: {},
  });
  expect(resolveUserMessage(error, "notification", registry)).toEqual({
    key: "errors:gateway.denied",
    params: { count: 2 },
  });
});

it("never serializes hostile exceptions, unknown codes, malformed details or hostile correlation values", () => {
  const corpus = [
    "/Users/fake/.ssh/id_rsa",
    ["sk", "ant", "fake", "not", "a", "real", "token"].join("-"),
    "SELECT secret_table FROM fake",
    "Error: fake\n at fake (/private/fake:1:1)",
    "stderr: fake output",
  ];
  for (const hostile of corpus) {
    const thrown = new Error(hostile);
    const wrapped = fromThrown(thrown);
    for (const error of [
      thrown,
      wrapped,
      { code: "newer.unknown", message: hostile },
      {
        code: "gateway.denied",
        message: hostile,
        details: { count: hostile },
        cause: thrown,
        correlationId: hostile,
      },
    ]) {
      const response = toErrorResponse(error, { correlationId: "request-123", registry });
      expect(JSON.stringify(response)).not.toContain(hostile);
      expect(response.body.error.correlationId).toBe("request-123");
      expect(response.body.error).not.toHaveProperty("cause");
    }
    expect(JSON.stringify(toErrorResponse(wrapped, { correlationId: hostile }))).not.toContain(
      hostile,
    );
  }
});
