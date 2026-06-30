import "@gorules/jdm-editor/dist/style.css";
import { DecisionGraph, JdmConfigProvider, type DecisionGraphType } from "@gorules/jdm-editor";
import { useCallback, useRef } from "react";

export interface GoRulesEditorProps {
  /** The JDM graph value (nodes + edges). Controlled or uncontrolled. */
  value?: DecisionGraphType;
  /** Default value for uncontrolled usage. */
  defaultValue?: DecisionGraphType;
  /** Called whenever the graph changes. */
  onChange?: (value: DecisionGraphType) => void;
  /** When true the graph is read-only (no drag/drop/edit). */
  disabled?: boolean;
  /** CSS height for the editor canvas. Defaults to "100%". */
  height?: string | number;
  /** Additional className applied to the wrapper div. */
  className?: string;
}

const EMPTY_GRAPH: DecisionGraphType = { nodes: [], edges: [] };

/**
 * GoRulesEditor
 *
 * A thin wrapper around `@gorules/jdm-editor` that:
 *  - Sets up `JdmConfigProvider` (required by the library)
 *  - Exposes a controlled `value`/`onChange` API matching our conventions
 *  - Provides sensible size defaults and a clean container
 */
export function GoRulesEditor({
  value,
  defaultValue,
  onChange,
  disabled = false,
  height = "100%",
  className,
}: GoRulesEditorProps) {
  // For uncontrolled usage, track internally
  const internalRef = useRef<DecisionGraphType>(defaultValue ?? EMPTY_GRAPH);

  const handleChange = useCallback(
    (next: DecisionGraphType) => {
      internalRef.current = next;
      onChange?.(next);
    },
    [onChange],
  );

  const resolvedValue = value ?? internalRef.current;

  return (
    <JdmConfigProvider>
      <div
        className={className}
        style={{
          width: "100%",
          height,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <DecisionGraph
          value={resolvedValue}
          disabled={disabled}
          onChange={handleChange}
        />
      </div>
    </JdmConfigProvider>
  );
}
