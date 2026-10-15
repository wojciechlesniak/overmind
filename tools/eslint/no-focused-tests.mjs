function rootIdentifier(node) {
  while (node.type === "MemberExpression" || node.type === "CallExpression") {
    node = node.type === "MemberExpression" ? node.object : node.callee;
  }
  return node.type === "Identifier" ? node.name : undefined;
}
export default {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      focused: "Focused tests are forbidden; run the complete suite.",
      skipped: "A skipped test requires // skip: OVE_XXX000 on the previous line.",
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (!["describe", "it", "test"].includes(rootIdentifier(node))) {
          return;
        }
        const name = node.computed ? node.property.value : node.property.name;
        if (name === "only") {
          context.report({ node, messageId: "focused" });
        }
        if (name === "skip") {
          const comment = context.sourceCode.getCommentsBefore(node).at(-1);
          if (
            !comment ||
            comment.type !== "Line" ||
            comment.loc.end.line !== node.loc.start.line - 1 ||
            !/^skip: OVE_[A-Z]{2,6}\d{3}$/.test(comment.value.trim())
          ) {
            context.report({ node, messageId: "skipped" });
          }
        }
      },
    };
  },
};
