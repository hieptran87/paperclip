# API Routes Contract: Gorules Business Rules Engine

All custom plugin API endpoints are registered on the Paperclip host with prefix `/api/plugins/gorules`.

## 1. List Rules
Retrieve all registered rules for the company.
- **Method**: `GET`
- **Path**: `/api/plugins/gorules/companies/:companyId/rules`
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "da5d4b53-631d-4ebc-b39f-26bbf31ef23f",
      "key": "discount-rules",
      "displayName": "Discount Rules",
      "description": "Calculates sales discounts based on tier and volume",
      "folder": "pricing",
      "filePath": "rules/discount-rules.json",
      "version": "1.0.0",
      "updatedAt": "2026-06-29T17:15:43.000Z"
    }
  ]
  ```

## 2. Upload/Register Rule
Upload a new Zen JDM JSON file and register it in the metadata database.
- **Method**: `POST`
- **Path**: `/api/plugins/gorules/companies/:companyId/rules`
- **Request Body**:
  ```json
  {
    "key": "discount-rules",
    "displayName": "Discount Rules",
    "description": "Calculates sales discounts based on tier and volume",
    "folder": "pricing",
    "content": { "nodes": [], "edges": [] }
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": "da5d4b53-631d-4ebc-b39f-26bbf31ef23f",
    "key": "discount-rules",
    "displayName": "Discount Rules",
    "folder": "pricing",
    "filePath": "rules/discount-rules.json",
    "version": "1.0.0"
  }
  ```

## 3. Delete Rule
Deletes the metadata record and removes the `.json` file from the workspace.
- **Method**: `DELETE`
- **Path**: `/api/plugins/gorules/companies/:companyId/rules/:key`
- **Response**: `204 No Content`

## 4. Get Rule Content *(NEW)*
Retrieve the raw JDM JSON content for a specific rule (for loading into the visual editor).
- **Method**: `GET`
- **Path**: `/api/plugins/gorules/companies/:companyId/rules/:key/content`
- **Auth**: `board-or-agent`
- **Response**: `200 OK`
  ```json
  {
    "key": "discount-rules",
    "content": { "nodes": [...], "edges": [...] },
    "version": "1.0.0"
  }
  ```

## 5. Update Rule Content *(NEW)*
Save updated JDM JSON content back to the workspace file and bump the version.
- **Method**: `POST`
- **Path**: `/api/plugins/gorules/companies/:companyId/rules/:key/content`
- **Auth**: `board`
- **Request Body**:
  ```json
  {
    "content": { "nodes": [...], "edges": [...] }
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "key": "discount-rules",
    "version": "1.0.1",
    "updatedAt": "2026-06-29T18:00:00.000Z"
  }
  ```

## 6. Move Rule to Folder *(NEW)*
Update the virtual folder assignment for a rule (for drag-and-drop tree re-parenting).
- **Method**: `PATCH`
- **Path**: `/api/plugins/gorules/companies/:companyId/rules/:key`
- **Auth**: `board`
- **Request Body**:
  ```json
  { "folder": "compliance" }
  ```
- **Response**: `200 OK`

## 7. Evaluate Rule
Runs a JSON input payload against a specified decision model and returns the output.
- **Method**: `POST`
- **Path**: `/api/plugins/gorules/companies/:companyId/rules/:key/evaluate`
- **Request Body**:
  ```json
  {
    "input": {
      "customer": { "tier": "premium" },
      "cart": { "total": 150 }
    }
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "result": {
      "discount": 0.15,
      "freeShipping": true
    },
    "performanceMs": 0.35
  }
  ```
