# Project Use Cases

## Overview
This document describes the primary use cases for the Flashback application, a blockchain-based distributed content management system integrated with Hyperledger Fabric via Kaleido.

---

## Use Case 1: User Registers and Browses Movie Channel

### Description
A new user registers for the platform, generates their Hyperledger Fabric identity, connects to the blockchain network, and browses the Movies channel to discover available content.

### Actors
- **Primary Actor**: New User
- **System Actors**: 
  - Hyperledger Fabric (Kaleido network)
  - Movies Channel Chaincode

### Preconditions
- The application is running and accessible
- The Kaleido network is operational
- The Movies channel exists on the blockchain

### Main Flow

1. **User Access Application**
   - User opens the Flashback application
   - Application loads at home page showing "Welcome to Fabric Desktop Client"

2. **Generate Fabric Identity**
   - User clicks "Keys" button to navigate to Key Management section
   - User clicks "Generate New Keypair" button
   - System generates cryptographic keypair (private/public keys)
   - System creates Fabric identity with:
     - User ID: "user1"
     - Organization: "Org1MSP" (from Kaleido config)
     - MSPID: "Org1MSP"
     - Network ID: "u0inmt8fjp" (from Kaleido)
   - User sees "Identity Generated" confirmation with all identity details
   - User clicks "Save Identity" to persist credentials

3. **Connect to Blockchain Network**
   - User clicks "Network" button to navigate to Network Connection section
   - System auto-populates Gateway URL from Kaleido configuration
   - System auto-populates CA (Certificate Authority) URL
   - User clicks "Connect to Network" button
   - System authenticates with Kaleido network using identity
   - Connection status changes from "🔴 Disconnected" to "🟢 Connected"
   - System displays Kaleido Network ID in status section

4. **Browse Movies Channel**
   - User clicks "Channels" button to navigate to Channel Browser
   - System loads and displays available channels:
     - Movies (Film icon)
     - TV Shows (TV icon)
     - Games (Gamepad icon)
     - Voting (Vote icon)
   - User sees "Movies" channel in the list with description "Movie database and torrent hashes"
   - User clicks on "Movies" channel
   - System queries the Movies chaincode using `queryAll` function
   - Channel browser displays:
     - Left sidebar with Movies channel selected (highlighted in cyan)
     - Right panel showing Movies title and description
     - Grid of movie content (if available)

### Postconditions
- User's identity is created and saved
- User is connected to the Kaleido network
- User can view available movies in the Movies channel
- Network status shows as connected on home page

### Alternative Flows

**A1: Identity Generation Fails**
- If keypair generation fails, error message is displayed
- User can retry the generation process

**A2: Network Connection Fails**
- If connection to Kaleido fails, error message is displayed
- User can verify network URLs and retry

**A3: Channel Loading Fails**
- If channel list fails to load, error message is displayed
- User can navigate back and retry

### Business Rules
- Identity must include organization from Kaleido configuration
- Network connection requires valid Kaleido credentials (App ID and Password)
- Only registered channels from the blockchain are displayed
- Users must be connected to access channel content

### Notes
- All user identities are tied to the Kaleido network configuration
- Connection status is maintained across navigation
- Movies channel is a core channel for content discovery

---

## Use Case 2: User Searches for Movie and Submits Missing Movie Request

### Description
A user browses the Movies channel, searches for a specific movie title, does not find it, and submits a request to add the missing movie by providing IMDb information and other details. The system uses IMDb ID as the unique identifier for movies.

### Actors
- **Primary Actor**: User
- **System Actors**: 
  - Hyperledger Fabric (Kaleido network)
  - Movies Channel Chaincode
  - Content Management Chaincode

### Preconditions
- User has completed Use Case 1 (registered, connected, in Movies channel)
- User is connected to the blockchain network
- Movies channel is loaded and showing available content
- The requested movie does not exist in the system

### Main Flow

1. **User Initiates Search**
   - User is in the Movies channel (from Use Case 1)
   - User sees search interface in the Movies channel view
   - User enters movie title in search field (e.g., "Inception")

2. **System Performs Search**
   - System queries Movies chaincode with search criteria
   - System searches through content by title
   - Search returns zero results (movie not found)
   - System displays message: "No results found for 'Inception'"

3. **User Initiates Content Request**
   - User clicks "Submit Missing Content" button
   - System opens modal/dialog for new content request
   - Dialog includes form with fields:
     - **IMDb ID** (required, unique identifier) - e.g., "tt1375666"
     - **Title** (required) - pre-filled from search query
     - **Director** (optional)
     - **Release Year** (optional)
     - **Genre** (optional, multiple selection)
     - **Description** (optional)
     - **Reason/Notes** (optional) - why user wants this content

4. **User Fills Content Request Form**
   - User enters IMDb ID: "tt1375666"
   - User confirms Title: "Inception"
   - User enters Director: "Christopher Nolan"
   - User selects Release Year: "2010"
   - User selects Genres: "Science Fiction", "Thriller"
   - User enters Description: "A skilled thief who steals corporate secrets through the use of dream-sharing technology"
   - User enters Notes: "Essential sci-fi classic"

5. **System Validates Request**
   - System validates IMDb ID format (must be non-empty string)
   - System validates IMDb ID uniqueness:
     - Queries chaincode to check if IMDb ID already exists
     - If exists: displays error "This movie (IMDb: tt1375666) is already in the system"
     - If not exists: proceeds
   - System validates Title is non-empty
   - System validates other optional fields for appropriate formats

6. **User Submits Request**
   - User clicks "Submit Request" button
   - System invokes Movies chaincode with `submitContentRequest` transaction
   - Transaction includes:
     - IMDb ID (as primary key/unique identifier)
     - All form data
     - Submitter user ID: "user1"
     - Timestamp of submission
     - Status: "pending_review"

7. **System Processes Request**
   - System writes transaction to blockchain ledger
   - Transaction is recorded with:
     - Immutable timestamp
     - Submitter identity
     - Request details
   - System displays success message: "Movie request submitted successfully. IMDb ID: tt1375666"
   - Request appears in pending queue (visible to content moderators)

### Postconditions
- Content request is recorded on the blockchain ledger
- Request status is "pending_review"
- IMDb ID is registered as submitted (preventing duplicates)
- Request is linked to submitter's user identity
- Moderators can review and approve/reject the request
- Once approved, movie will be queryable in Movies channel

### Alternative Flows

**A1: IMDb ID Already Exists**
- System checks if IMDb ID already exists in database
- If exists: displays message "This movie is already in the system" with link to view it
- User can cancel or search for the existing movie instead

**A2: Invalid IMDb ID Format**
- If IMDb ID is empty or improperly formatted
- System displays validation error: "Invalid IMDb ID format"
- User can correct and resubmit

**A3: Network Error During Submission**
- If blockchain transaction fails midway
- System displays: "Failed to submit request. Please try again."
- User can retry the submission

**A4: User Cancels Request**
- User clicks "Cancel" button in the form
- Dialog closes, user returns to Movies channel view
- No transaction is recorded

### Business Rules
1. **IMDb ID Uniqueness**: Each movie must have a unique IMDb ID
   - No two movies can share the same IMDb ID
   - System enforces this at the blockchain level
   
2. **Immutability**: Once submitted, request cannot be modified
   - Audit trail is preserved
   - Original request data is permanent
   
3. **Required Fields**: 
   - IMDb ID must be provided
   - Title must be provided
   
4. **Status Workflow**:
   - New request starts as "pending_review"
   - Moderators can change status to "approved" or "rejected"
   - Only "approved" requests appear in movie listings
   
5. **Duplicate Prevention**:
   - System prevents submitting request for movie that already exists
   - System prevents submitting duplicate requests for the same IMDb ID

6. **Submission Tracking**:
   - Each request is linked to the submitter's user identity
   - User can view their submission history
   - Timestamp is automatically recorded by blockchain

### Data Model

```typescript
interface ContentRequest {
  // Unique identifiers
  imdb_id: string;        // Primary key, unique per movie
  request_id: string;     // Unique per request (UUID)
  
  // Content information
  title: string;
  director?: string;
  release_year?: number;
  genres?: string[];
  description?: string;
  
  // Request metadata
  submitter_id: string;   // User who submitted
  submitted_at: string;   // ISO timestamp
  notes?: string;
  
  // Status tracking
  status: "pending_review" | "approved" | "rejected" | "in_progress";
  reviewed_by?: string;   // Moderator ID
  reviewed_at?: string;   // ISO timestamp
  rejection_reason?: string;
}
```

### Notes
- IMDb ID serves as the universal unique identifier for movies
- Prevents duplicate movie entries in the system
- Allows cross-referencing with external IMDb database
- Request process is transparent and blockchain-verified
- Users can track status of their submissions

---

## Use Case 3: Moderator Reviews and Approves Content Request

### Description
A content moderator reviews submitted movie requests, verifies IMDb information, and approves or rejects requests to add new movies to the catalog.

### Actors
- **Primary Actor**: Content Moderator
- **System Actors**: 
  - Hyperledger Fabric
  - Content Management Chaincode

### Preconditions
- One or more content requests are in "pending_review" status
- Moderator is logged in with appropriate permissions
- Moderator can access the content review queue

### Main Flow

1. **Moderator Views Pending Requests**
   - Moderator navigates to "Content Review" section
   - System queries chaincode for all pending requests
   - System displays list of submissions with:
     - Movie title
     - IMDb ID
     - Submitter name
     - Submission date
     - Request status badge

2. **Moderator Selects Request to Review**
   - Moderator clicks on a pending request
   - System displays full request details:
     - All movie information (title, director, year, genres, description)
     - IMDb ID with link to IMDb verification
     - Submitter identity
     - Submission timestamp
     - Any notes from submitter

3. **Moderator Verifies Information**
   - Moderator can click "Verify on IMDb" link to check external source
   - Moderator confirms data accuracy:
     - Title matches IMDb
     - Director and year are correct
     - Genres are appropriate
     - Description is accurate

4. **Moderator Approves Request**
   - If information is valid, moderator clicks "Approve Request"
   - System invokes chaincode with `approveContentRequest` transaction
   - Transaction updates request status to "approved"
   - Request is added to the active Movies catalog
   - Movie becomes queryable and searchable in the channel

### Postconditions
- Request status is updated to "approved"
- Movie entry is created in Movies channel
- Movie is available for users to discover and download
- Transaction is recorded on blockchain with moderator identity

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Application                          │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Key Mgmt     │  │ Network     │  │ Channel Browser  │   │
│  │ - Generate   │  │ - Connect   │  │ - Browse Movies  │   │
│  │   Identity   │  │ - Status    │  │ - Search Content │   │
│  └──────────────┘  └─────────────┘  └──────────────────┘   │
│        ↓                  ↓                    ↓              │
├─────────────────────────────────────────────────────────────┤
│                    Tauri Backend                             │
│  - Identity Management                                       │
│  - Fabric Client Wrapper                                     │
│  - Chaincode Invocations                                     │
└──────────────────────────────────────────────────────────────┘
                        ↓
         ┌──────────────────────────────────────┐
         │   Kaleido Network (Hyperledger)      │
         │  ┌────────────────────────────────┐  │
         │  │  Movies Channel                │  │
         │  │  - queryAll()                  │  │
         │  │  - submitContentRequest()      │  │
         │  │  - approveContentRequest()     │  │
         │  └────────────────────────────────┘  │
         └──────────────────────────────────────┘
```

---

## Acceptance Criteria

### Use Case 1
- [ ] User can generate keypair with proper identity
- [ ] User can connect to Kaleido network
- [ ] User can access Movies channel
- [ ] Movies channel displays with proper title and description
- [ ] Connection status is maintained across navigation

### Use Case 2
- [ ] User can search for movies in the channel
- [ ] Search returns zero results for non-existent movie
- [ ] User can click "Submit Missing Content" button
- [ ] Form displays with all required and optional fields
- [ ] System validates IMDb ID uniqueness before submission
- [ ] Request is successfully submitted to blockchain
- [ ] Success message displays with IMDb ID confirmation

### Use Case 3
- [ ] Moderator can view list of pending requests
- [ ] Moderator can view full request details
- [ ] Moderator can approve request
- [ ] Approved request appears in Movies channel
- [ ] Blockchain records moderator approval with identity

---

## Future Use Cases

### Use Case 4: Download Movie via Torrent
- User browses approved movies
- User clicks "Download" on a movie
- System initiates WebTorrent download using torrent hash from blockchain
- Download progress is tracked and displayed
- Completed movie is saved locally

### Use Case 5: Voting and Rating System
- User rates movie (1-5 stars)
- User can vote on pending content requests
- Voting results are recorded on blockchain
- Aggregate ratings displayed on movie cards
- Popular movies are promoted in UI

### Use Case 6: Content Curation and Channels
- Creator can create and manage custom channels
- Channel curator can curate lists of movies
- Users can subscribe to custom channels
- Curated lists are stored on blockchain

---

## Testing Strategy

Each use case has corresponding E2E tests in `cypress/e2e/use-cases.cy.ts`:
- **Use Case 1 Tests**: Complete registration and channel access workflow
- **Use Case 2 Tests**: Search, missing content submission, and validation
- **Use Case 3 Tests**: Moderator review and approval workflow (when UI added)

See [E2E Test Results](#e2e-test-results) section for detailed test coverage.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Chaincode** | Smart contracts on Hyperledger Fabric that execute business logic |
| **Channel** | A blockchain sub-network (e.g., Movies, Gaming) with its own ledger |
| **Identity** | User's cryptographic credentials (private/public keys + certificate) |
| **IMDb ID** | International Movie Database unique identifier (format: tt#######) |
| **Kaleido** | Blockchain-as-a-Service platform providing Hyperledger Fabric network |
| **Ledger** | The immutable record of all transactions on the blockchain |
| **MSPID** | Membership Service Provider ID identifying organization on blockchain |
| **Torrent** | Peer-to-peer file sharing protocol for distributed downloads |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-01 | Development Team | Initial use cases and E2E tests |
| 1.1 | TBD | TBD | Add moderator approval UI and tests |
| 2.0 | TBD | TBD | Add Use Cases 4-6 (downloads, voting, curation) |
