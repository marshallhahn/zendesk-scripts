**Bulk Export and Delete Data Using the Zendesk API**

This project includes the following Zendesk scripts:

Zendesk Support:
- ticket_delete.js
- ticket_export_incremental.js
- ticket_search.js
- ticket_subject.js
- user_delete.js
- user_search.js

Zendesk Guide:
- posts_export.js
- posts_patch.js

**Usage**

To run the scripts use the following commands.

| **Command** | **Description** |
|---|---|
| node **ticket_delete.js** soft-delete {Ticket IDs} | Soft delete tickets in bulk. Ticket IDs is a comma separated list. |
| node **ticket_delete.js** restore {Ticket IDs} | Restore tickets in bulk. Ticket IDs is a comma separated list. |
| node **ticket_delete.js** permanently-delete {Ticket IDs} | Permanently delete tickets in bulk. Ticket IDs is a comma separated list. |
| node **ticket_search.js** | Searches for ticket IDs needed to run **ticket_delete.js** |
| node **ticket_export.js** | Exports tickets in bulk |
