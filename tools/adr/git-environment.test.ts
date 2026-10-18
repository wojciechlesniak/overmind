import { expect, test } from "vitest";
import { productionGitEnvironment } from "./ports.ts";

test("production Git preserves only named transport overrides and normal config discovery", () => {
  const environment = productionGitEnvironment({
    HOME: "/fake-owner",
    XDG_CONFIG_HOME: "/fake-xdg",
    PATH: "/fake-bin",
    GIT_DIR: "/unrelated",
    GIT_CONFIG_GLOBAL: "/unrelated",
    GIT_TRACE: "/unrelated",
    GIT_SSL_NO_VERIFY: "1",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: "wrong-marker",
    GIT_TERMINAL_PROMPT: "1",
    GIT_SSH_COMMAND: "fixture-transport",
    GIT_SSL_CAINFO: "/fake-ca",
  });
  expect(environment).toEqual({
    HOME: "/fake-owner",
    XDG_CONFIG_HOME: "/fake-xdg",
    PATH: "/fake-bin",
    GIT_SSH_COMMAND: "fixture-transport",
    GIT_SSL_CAINFO: "/fake-ca",
    GIT_TERMINAL_PROMPT: "0",
  });
});
