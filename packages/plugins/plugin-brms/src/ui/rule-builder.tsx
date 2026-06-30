import { GoRulesEditor, type GoRulesEditorProps } from "@paperclipai/plugin-sdk/ui";

export type { GoRulesEditorProps };

/**
 * RuleBuilder — wraps the host-provided GoRulesEditor via the plugin bridge.
 *
 * The actual `@gorules/jdm-editor` library lives in the host (ui package)
 * and is injected at runtime through the bridge.  This component is a thin
 * re-export so the rest of the plugin UI can import from a single, stable path.
 */
export default function RuleBuilder(props: GoRulesEditorProps) {
  return <GoRulesEditor {...props} />;
}