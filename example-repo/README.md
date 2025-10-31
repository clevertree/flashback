# Example Repository

This is an example repository structure for Flashback that demonstrates the repository script interface.

## Structure

- `scripts/` - Repository operation scripts
  - `search.js` - Search through data by title or other fields
  - `browse.js` - Browse hierarchical data structure
  - `insert.js` - Insert new records with validation
  - `remove.js` - Remove records by primary_index
  - `comment.js` - Add comments to records
- `data/` - Repository data storage (organized by primary_index)

## Script Interface

Each script exports an async function that receives an input object and returns a result object.

### search.js
```
Input: { query: string, field?: string, dataDir: string }
Output: { results: [], count: number, query, field }
```

### browse.js
```
Input: { path?: string, depth?: number, dataDir: string }
Output: { tree: {}, count: number, path, depth }
```

### insert.js
```
Input: { payload: {primary_index: string, ...}, rules?: {}, dataDir: string }
Output: { success: boolean, id: string, path: string, size: number }
```

### remove.js
```
Input: { primary_index: string, id?: string, dataDir: string }
Output: { success: boolean, removed: number, message: string }
```

### comment.js
```
Input: { primary_index: string, id: string, email: string, comment: string, dataDir: string }
Output: { success: boolean, comment_id: string, path: string, created_at: string }
```

## Data Organization

Data is organized by `primary_index`:

```
data/
  movies/
    movie_1_abc123.json
    movie_2_def456.json
    comments/
      user@example.com/
        1234567890_xyz.md
  tv_shows/
    show_1_ghi789.json
```

## Security Notes

All scripts are designed to:
- Prevent directory traversal attacks
- Validate all inputs strictly
- Only operate within the repository's data directory
- Support sandboxed execution

## Running Locally

To test scripts locally:

```bash
# Copy example-repo to fileRootDirectory/repos/
cp -r example-repo /path/to/fileRootDirectory/repos/

# Test search
node scripts/search.js

# Test browse
node scripts/browse.js
```
