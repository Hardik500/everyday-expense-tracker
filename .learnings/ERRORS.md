# Errors

Operational failures, integration issues, and tool failures.

**Statuses**: pending | in_progress | resolved | wont_fix | recurring
**Areas**: frontend | backend | infra | tests | docs | config

## Status Definitions

| Status | Meaning |
|--------|---------|
| `pending` | Not yet addressed |
| `in_progress` | Actively being investigated/fixed |
| `resolved` | Issue fixed |
| `wont_fix` | Decided not to address (document reason) |
| `recurring` | Same error keeps happening (needs systematic fix) |

## Error Entry Template

```markdown
## [ERR-YYYYMMDD-XXX] skill_or_command_name

**Logged**: ISO-8601 timestamp
**Priority**: high
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Summary
Brief description of what failed

### Error
```
Actual error message or output
```

### Context
- Command/operation attempted
- Input or parameters used
- Environment details if relevant

### Suggested Fix
If identifiable, what might resolve this

### Metadata
- Reproducible: yes | no | unknown
- Related Files: path/to/file.ext
- See Also: ERR-20250110-001 (if recurring)

---
```

---
