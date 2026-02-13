# Page snapshot

```yaml
- generic [ref=e4]:
  - img [ref=e7]
  - heading "Something went wrong" [level=1] [ref=e9]
  - paragraph [ref=e10]: We encountered an unexpected error. Don't worry, your data is safe. Try refreshing the page or go back to the dashboard.
  - group [ref=e11]:
    - generic "Error Details" [ref=e12] [cursor=pointer]
  - generic [ref=e13]:
    - button "Refresh Page" [ref=e14] [cursor=pointer]:
      - img [ref=e15]
      - text: Refresh Page
    - button "Go Home" [ref=e17] [cursor=pointer]:
      - img [ref=e18]
      - text: Go Home
  - button "Clear cache and retry" [ref=e20] [cursor=pointer]
  - paragraph [ref=e21]: If this error persists, please contact support with the error details.
```