# Use Case Diagram — Record Over Rhetoric

Mermaid does not have a native UML use-case diagram type, so this uses a
flowchart with a system boundary. Ovals are use cases; stadium shapes are actors.

```mermaid
flowchart LR
    Visitor([Public visitor])
    User([Registered user])
    Verified([Verified user])
    AI([AI panel<br/>OpenRouter])
    Mail([SMTP provider])

    subgraph ROR["Record Over Rhetoric"]
        direction TB
        Browse((Browse offices))
        ViewCand((View candidate profile))
        ViewVotes((View vote history))
        Register((Register account))
        Verify((Verify e-mail))
        Login((Log in))
        Reset((Recover password))
        Compare((Run a comparison))
        ViewResult((View comparison result))
        History((View comparison history))
        Docs((Read methodology and disclaimer))
    end

    Visitor --> Browse
    Visitor --> ViewCand
    Visitor --> ViewVotes
    Visitor --> Register
    Visitor --> Login
    Visitor --> Reset
    Visitor --> Docs

    Register --> Verify
    Verify --> User
    Login --> User
    Reset --> User

    User --> Compare
    User --> ViewResult
    User --> History

    Compare --> AI
    Register --> Mail
    Reset --> Mail
    Verify --> Mail

    Compare -.->|requires verified login| Verified
```

Notes:

- Comparisons require an authenticated, e-mail-verified account.
- The AI panel and SMTP provider are external systems, not actors who initiate
  use cases.
- All browsing and result viewing is public except a user's saved history.
