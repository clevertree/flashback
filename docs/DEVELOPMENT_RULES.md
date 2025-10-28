# Development Rules & Guidelines

## Component Development

1. **Break down large React components** into meaningful smaller components
2. **Create Cypress tests** in `./test/*` for each component and verify the test in CLI
3. **Maintain build compatibility** between Windows/OSX/Ubuntu

## Documentation Requirements

4. **Maintain FEATURES.md** with all client and server features
6. **Maintain COMMANDS.md** with all client commands and server responses

## Protocol Implementation

8. **Maintain a run-time configuration file** with defaults filled in for all server/client features

## Testing Standards

- All components must have corresponding Cypress tests
- Tests must pass in CLI before deployment
- Cross-platform compatibility must be verified
- Use E2E cli regression test on big changes
- All API tests must use cy.request<TYPE> and use the API request and response interfaces

## Build Requirements

- Windows compatibility required
- OSX compatibility required
- Ubuntu compatibility required
- Runtime configuration with sensible defaults

## API Development

1. Ensure type safety for every API route:
    - Define a TypeScript `interface` or `type` for the request body (if any)
    - Define a TypeScript `interface` or `type` for querystring and/or route params (if any)
    - Use these types at the top of each `route.ts` file and in the handler implementation
2. Prefer narrow types over `any` and use discriminated unions/enums where applicable
3. Keep request/response shapes documented close to the code (JSDoc) and in `COMMANDS.md`
4. All API calls must have an interface for request parameters if they exist, and response

Example (Next.js route):

```ts
// types
interface RepoListQuery {
    search?: string;
    limit?: number; // default 50
}

interface CreateRepoBody {
    title: string;
    url: string;
}

// usage in handlers
export async function GET(req: NextRequest) {
    const {searchParams} = new URL(req.url);
    const q: RepoListQuery = {
        search: searchParams.get('search') ?? undefined,
        limit: Number(searchParams.get('limit') ?? 50),
    };
    // ...
}

export async function POST(req: NextRequest) {
    const body = (await req.json()) as CreateRepoBody;
    // ...
}
```
