export async function register() {
  // Node-only code lives in its own file so the edge bundle never sees native modules.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    registerNode();
  }
}
