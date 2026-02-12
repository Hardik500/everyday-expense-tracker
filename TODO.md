# TODO - Expense Tracker Post-Sprint

**Created**: 2026-02-12 03:35 UTC  
**Context**: After completing 17-feature UX sprint

---

## 🔧 Technical Debt

### Phase 3 Frontend Integration
- [ ] **Data Backup/Restore UI** - Buttons for JSON export/import
  - Export button (triggers download)
  - Import file picker with validation
  - Progress indicator for large datasets
  
- [ ] **Duplicate Detection Interface** - Review and merge duplicates
  - List view of detected duplicates
  - Side-by-side comparison
  - Bulk merge/delete actions
  
- [ ] **Goals Dashboard** - Visual progress tracking
  - Progress bars for each goal
  - Deadline countdown
  - Contribution buttons
  - Category-linked goals
  
- [ ] **Cash Flow Calendar** - Monthly spending view
  - Calendar grid with daily net values
  - Color coding (green/red for positive/negative)
  - Click day to see transactions

---

## ✅ Quality Assurance

- [ ] **E2E Testing** 
  - Test all 17 new features end-to-end
  - Mobile responsiveness validation
  - Cross-browser testing
  
- [ ] **Load Testing**
  - Performance with 10k+ transactions
  - API response times
  - Database query optimization

- [ ] **Security Audit**
  - Review 19 new Phase 3 endpoints
  - Verify auth on all routes
  - Rate limiting on expensive operations
  - Input sanitization on file uploads

---

## 📊 Monitoring & Observability

- [ ] **Error Tracking**
  - Integrate Sentry or similar
  - Alert on 500 errors
  - Track frontend crashes
  
- [ ] **Analytics**
  - Feature usage tracking
  - User engagement metrics
  - Performance monitoring

- [ ] **Health Monitoring**
  - Automated health checks
  - Database connection monitoring
  - Disk space alerts

---

## 📝 Documentation

- [ ] **User Guide**
  - How to use new features
  - Tips for bulk edit, duplicate detection
  - Goals setup guide
  
- [ ] **API Documentation**
  - Update Swagger descriptions
  - Example requests/responses
  - Authentication requirements
  
- [ ] **Changelog**
  - List all 17 features for users
  - Breaking changes (if any)
  - Migration notes

---

## 🚀 Future Enhancements

### Phase 4 Ideas
- [ ] **Split Transactions** - Multi-category transactions (backend ready)
- [ ] **Recurring Expenses UI** - Manage recurring bills
- [ ] **Net Worth Tracking** - Assets vs liabilities over time
- [ ] **Monthly PDF Reports** - Auto-generated spending summaries

### Performance
- [ ] **Code Splitting** - Reduce frontend bundle size
- [ ] **Image Optimization** - Lazy loading, WebP
- [ ] **Query Optimization** - Database index review

### Integrations
- [ ] **Plaid/Yodlee** - Bank account connection
- [ ] **Multi-currency** - Exchange rates, currency switching
- [ ] **Tax Categories** - Tag transactions for tax reporting

---

## 🎯 Priority Matrix

| Priority | Items |
|----------|-------|
| **P0** | Frontend integration for Phase 3 (4 features) |
| **P1** | Security audit, E2E testing |
| **P2** | Monitoring, analytics, documentation |
| **P3** | Future enhancements (Phase 4) |

---

**Last Updated**: 2026-02-12 03:35 UTC  
**Status**: Tracking for future sprints
