# Agent Tools Contract: Gorules Business Rules Engine

The plugin registers a custom agent tool to let company AI agents evaluate decisions.

## `evaluate_rule`
Evaluates a stored JSON Decision Model (JDM) rule against a provided context.

### Parameters Schema
```json
{
  "type": "object",
  "properties": {
    "key": {
      "type": "string",
      "description": "The unique alphanumeric key of the rule model to evaluate (e.g. 'discount-rules')."
    },
    "input": {
      "type": "object",
      "description": "The input context JSON payload to pass to the decision engine (contains variables needed by the decision table)."
    }
  },
  "required": ["key", "input"]
}
```

### Response Format
On successful evaluation, returns the Zen Engine evaluation output:
```json
{
  "success": true,
  "result": {
    "discount": 0.15,
    "freeShipping": true
  }
}
```

On validation or execution failure:
```json
{
  "success": false,
  "error": "Rule model 'discount-rules' not found"
}
```
OR:
```json
{
  "success": false,
  "error": "Zen Engine execution failed: circular dependency detected in node 'Node_A'"
}
```
