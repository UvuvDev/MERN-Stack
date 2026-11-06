# ER Diagram — Record Over Rhetoric

Matches §6 of `docs/PROJECT_SPEC.md` (Mongoose models in `server/src/models`).

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string email UK "required, unique, lowercase, trimmed"
        string passwordHash "required, select false"
        string displayName "required, 2-80 chars"
        boolean isVerified "default false"
        string verificationTokenHash "sha256, select false"
        date verificationExpiresAt
        string resetTokenHash "sha256, select false"
        date resetExpiresAt
        date lastLoginAt
        date createdAt
        date updatedAt
    }

    OFFICE {
        ObjectId _id PK
        string slug UK "unique, e.g. us-senate-ga"
        string name "e.g. U.S. Senate - Georgia"
        string level "federal | state | local"
        string state "2-letter or null"
        string district "null or e.g. 5"
        string description
        date createdAt
        date updatedAt
    }

    CANDIDATE {
        ObjectId _id PK
        string slug UK "unique"
        string name
        string party
        ObjectId office FK "required -> Office"
        string state
        string district
        string photoUrl "optional"
        string officialUrl "optional, NOT sent to AI"
        string bio "optional, NOT sent to AI"
        boolean isSample "true for seeded fictional data"
        date createdAt
        date updatedAt
    }

    BILL {
        ObjectId _id PK
        number congress
        string chamber "house | senate"
        string number "e.g. H.R. 1234"
        string title
        string summary "neutral, factual"
        string_array topics "e.g. taxes, labor"
        date introducedAt
        string sponsor
        string sourceUrl
        boolean isSample
    }

    VOTE {
        ObjectId _id PK
        ObjectId candidate FK "required -> Candidate"
        ObjectId bill FK "required -> Bill"
        string position "yes | no | abstain | absent"
        date castAt
        string note
    }

    COMPARISON {
        ObjectId _id PK
        ObjectId user FK "required -> User"
        ObjectId candidateA FK "-> Candidate"
        ObjectId candidateB FK "-> Candidate"
        ObjectId office FK "-> Office"
        object votesSnapshot "candidateA: Number, candidateB: Number"
        json models "array: key, modelId, ok, latencyMs, analysis, error"
        date createdAt
        date updatedAt
    }

    OFFICE ||--o{ CANDIDATE : "contains"
    OFFICE ||--o{ COMPARISON : "scopes"
    USER ||--o{ COMPARISON : "runs"
    CANDIDATE ||--o{ VOTE : "casts"
    BILL ||--o{ VOTE : "receives"
    CANDIDATE ||--o{ COMPARISON : "candidateA"
    CANDIDATE ||--o{ COMPARISON : "candidateB"
```

Unique / compound indexes: `User.email`; `Office.slug`; `Candidate.slug`;
`Candidate.office`; `Vote {candidate, bill}` unique; `Comparison {user, createdAt}`.
