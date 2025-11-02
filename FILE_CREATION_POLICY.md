# File Creation Policy - Use Proper Tools Only

## Policy Statement

**ALL file creation MUST use proper file creation tools. Using `cat` or heredoc syntax to create files is STRICTLY PROHIBITED.**

This policy ensures consistency, trackability, and proper integration with the development environment.

---

## Enforcement Rules

### ❌ Prohibited Methods
```bash
# NEVER use cat to create files
cat > filename.txt << 'EOF'
content here
EOF

# NEVER use heredoc syntax
cat > file.sh << 'HEREDOC'
content
HEREDOC

# NEVER use echo redirects for file creation
echo "content" > file.txt
```

### ✅ Allowed Methods

**Use the `create_file` tool** (Recommended):
```typescript
// Create new files with the create_file tool
create_file({
  filePath: "/path/to/file.ext",
  content: "file content here"
})
```

**Use the `replace_string_in_file` tool for modifications**:
```typescript
// Edit existing files
replace_string_in_file({
  filePath: "/path/to/file.ext",
  oldString: "old content",
  newString: "new content"
})
```

---

## Why This Policy?

### Trackability
- All file operations are logged in tool calls
- Easy to audit what files were created and when
- Clear record in conversation history

### Consistency
- All developers use the same method
- Predictable file creation process
- No variations in approach

### Error Handling
- Proper tools provide error feedback
- File creation is validated
- Content is verified before writing

### Version Control
- Changes are clearly documented
- Integration with git is transparent
- No unexpected file modifications

---

## Benefits

1. **Auditability**: Every file creation is tracked and documented
2. **Reliability**: Proper tools ensure files are created correctly
3. **Consistency**: Same approach across all projects
4. **Integration**: Works seamlessly with VS Code and development workflow
5. **Debugging**: Clear error messages if creation fails

---

## When to Use Each Tool

### `create_file` Tool
Use for:
- Creating new files
- Configuration files
- Documentation
- Test files
- Scripts
- Any new file creation

```typescript
create_file({
  filePath: "/Users/ari.asulin/dev/test/rust2/filename.ext",
  content: "File content here..."
})
```

### `replace_string_in_file` Tool
Use for:
- Editing existing files
- Modifying specific sections
- Fixing bugs in files
- Updating content

```typescript
replace_string_in_file({
  filePath: "/Users/ari.asulin/dev/test/rust2/existing-file.ext",
  oldString: "old content with context",
  newString: "new content with context"
})
```

### `run_in_terminal` Tool
Use ONLY for:
- Running commands
- Checking status
- Building/testing
- Git operations
- NOT for file creation

```bash
# ✅ Allowed - running commands
npm run build

# ❌ NOT Allowed - creating files
cat > file.txt << EOF
content
EOF
```

---

## Comparison: Cat vs Proper Tools

### Using `cat` (❌ PROHIBITED)
```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# script content
EOF
chmod +x .git/hooks/pre-commit
```

**Problems**:
- No audit trail in tools
- Hard to track what was created
- Error handling unclear
- Not part of standard workflow

### Using `create_file` Tool (✅ RECOMMENDED)
```typescript
create_file({
  filePath: "/Users/ari.asulin/dev/test/rust2/.git/hooks/pre-commit",
  content: "#!/bin/bash\n# script content\n"
})
```

**Benefits**:
- Clear in conversation history
- Properly tracked
- Error feedback
- Standard approach

---

## Common Scenarios

### Scenario 1: Create a new script
```typescript
// ✅ CORRECT
create_file({
  filePath: "/Users/ari.asulin/dev/test/rust2/scripts/deploy.sh",
  content: "#!/bin/bash\n\necho 'Deploying...'\n"
})

// ❌ INCORRECT
cat > scripts/deploy.sh << 'EOF'
#!/bin/bash

echo 'Deploying...'
EOF
```

### Scenario 2: Create configuration file
```typescript
// ✅ CORRECT
create_file({
  filePath: "/Users/ari.asulin/dev/test/rust2/.env.local",
  content: "API_KEY=secret\nDATABASE_URL=connection"
})

// ❌ INCORRECT
cat > .env.local << 'EOF'
API_KEY=secret
DATABASE_URL=connection
EOF
```

### Scenario 3: Modify existing file
```typescript
// ✅ CORRECT
replace_string_in_file({
  filePath: "/Users/ari.asulin/dev/test/rust2/package.json",
  oldString: '"version": "1.0.0"',
  newString: '"version": "1.0.1"'
})

// ❌ INCORRECT (uses cat to recreate file)
cat > package.json << 'EOF'
{ "version": "1.0.1" }
EOF
```

---

## Compliance Checklist

- [ ] I will never use `cat` to create files
- [ ] I will never use heredoc syntax for file creation
- [ ] I will never use echo redirects for file creation
- [ ] I will use `create_file` tool for new files
- [ ] I will use `replace_string_in_file` tool for modifications
- [ ] I understand this policy is mandatory
- [ ] I accept the consequences of violations

---

## Violations and Consequences

### What Happens if This Rule is Violated?

1. **Detection**: File creation with `cat` will be identified in tool calls
2. **Correction**: File will need to be recreated using proper tools
3. **Documentation**: Violation will be noted in review
4. **Training**: Team member will be reminded of policy

### Repeated Violations
- May indicate need for additional training
- Could affect code review process
- Will be discussed in team meetings

---

## For Team Leads

### Enforcement
- Monitor tool usage in conversations
- Flag any `cat` file creation commands
- Provide coaching and training
- Update team on policy compliance

### Reviews
- Check commit messages for evidence of `cat` usage
- Verify all files were created with proper tools
- Maintain policy compliance standards

---

## Questions?

If you have questions about file creation:

1. **When unsure**: Ask before creating file
2. **For scripts**: Use `create_file` tool
3. **For modifications**: Use `replace_string_in_file` tool
4. **For commands**: Use `run_in_terminal` tool
5. **For anything else**: Ask for guidance

---

**Last Updated**: November 1, 2025
**Status**: ACTIVE - Strictly Enforced
**Tool Usage**: Required for all file operations
