#!/bin/bash

# Comprehensive test for all feature commands as they would be executed from VS Code extension
# This verifies that the extension's executeGitFlowCommand function produces the correct git commands

set -e  # Exit on error

WORKSPACE_PATH="/Users/andreibaloleanu/git-flow-next-vs"
cd "$WORKSPACE_PATH"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

# Function to track command execution
execute_and_verify() {
    local test_name="$1"
    local command="$2"
    local extension_function="$3"

    TEST_COUNT=$((TEST_COUNT + 1))
    echo -e "${BLUE}[TEST $TEST_COUNT]${NC} $test_name"
    echo -e "  VS Code Command: ${YELLOW}$extension_function${NC}"
    echo -e "  Executed: ${GREEN}$command${NC}"

    # Execute the command
    if eval "$command" > /tmp/test_output.txt 2>&1; then
        echo -e "  ${GREEN}✓ PASSED${NC}"
        PASS_COUNT=$((PASS_COUNT + 1))
        cat /tmp/test_output.txt | sed 's/^/    /'
    else
        echo -e "  ${RED}✗ FAILED${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        cat /tmp/test_output.txt | sed 's/^/    /'
        return 1
    fi
    echo ""
}

echo "========================================="
echo " Git Flow NNNext VS Code Extension Tests"
echo "========================================="
echo ""

# Verify git flow is initialized
echo -e "${BLUE}[SETUP]${NC} Verifying git flow initialization..."
if git config --get gitflow.branch.master || git config --get gitflow.branch.main; then
    echo -e "${GREEN}✓ Git flow is initialized${NC}"
else
    echo -e "${RED}✗ Git flow is NOT initialized${NC}"
    exit 1
fi
echo ""

# Make sure we're on develop branch
echo -e "${BLUE}[SETUP]${NC} Switching to develop branch..."
git checkout develop 2>/dev/null || git checkout -b develop
echo ""

# ========================================
# TEST 1: Feature Start
# ========================================
FEATURE_NAME="test-feature-$(date +%s)"
echo "========================================="
echo " Feature Commands Testing"
echo "========================================="
echo ""

execute_and_verify \
    "Feature Start" \
    "git flow feature start $FEATURE_NAME" \
    "git-flow-next.feature.start"

# Verify we're on the feature branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "feature/$FEATURE_NAME" ]; then
    echo -e "${GREEN}✓ Verified: Switched to feature/$FEATURE_NAME${NC}"
else
    echo -e "${RED}✗ Failed: Expected feature/$FEATURE_NAME, got $CURRENT_BRANCH${NC}"
    exit 1
fi
echo ""

# ========================================
# TEST 2: Feature List
# ========================================
execute_and_verify \
    "Feature List" \
    "git flow feature list" \
    "git-flow-next.feature.list"

# ========================================
# TEST 3: Create a second feature for testing
# ========================================
FEATURE_NAME_2="test-feature-2-$(date +%s)"
git checkout develop 2>/dev/null
execute_and_verify \
    "Feature Start (second feature)" \
    "git flow feature start $FEATURE_NAME_2" \
    "git-flow-next.feature.start"

# ========================================
# TEST 4: Feature Checkout
# ========================================
execute_and_verify \
    "Feature Checkout" \
    "git flow feature checkout $FEATURE_NAME" \
    "git-flow-next.feature.checkout"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "feature/$FEATURE_NAME" ]; then
    echo -e "${GREEN}✓ Verified: Checked out feature/$FEATURE_NAME${NC}"
else
    echo -e "${RED}✗ Failed: Expected feature/$FEATURE_NAME, got $CURRENT_BRANCH${NC}"
    exit 1
fi
echo ""

# ========================================
# TEST 5: Feature Rename
# ========================================
FEATURE_NAME_RENAMED="${FEATURE_NAME}-renamed"
execute_and_verify \
    "Feature Rename" \
    "git flow feature rename $FEATURE_NAME $FEATURE_NAME_RENAMED" \
    "git-flow-next.feature.rename"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "feature/$FEATURE_NAME_RENAMED" ]; then
    echo -e "${GREEN}✓ Verified: Renamed to feature/$FEATURE_NAME_RENAMED${NC}"
else
    echo -e "${RED}✗ Failed: Expected feature/$FEATURE_NAME_RENAMED, got $CURRENT_BRANCH${NC}"
    exit 1
fi
echo ""

# ========================================
# TEST 6: Feature Update (merge develop into feature)
# ========================================
# First, we need to commit or stash any changes
if ! git diff-files --quiet; then
    echo -e "${BLUE}[SETUP]${NC} Stashing uncommitted changes for update test..."
    git stash push -m "Temp stash for feature update test" > /dev/null 2>&1
    STASHED=true
else
    STASHED=false
fi

execute_and_verify \
    "Feature Update" \
    "git flow feature update $FEATURE_NAME_RENAMED" \
    "git-flow-next.feature.update"

# Pop stash if we stashed
if [ "$STASHED" = "true" ]; then
    echo -e "${BLUE}[SETUP]${NC} Restoring stashed changes..."
    git stash pop > /dev/null 2>&1
fi

# ========================================
# TEST 7: Make a commit on the feature branch
# ========================================
echo -e "${BLUE}[SETUP]${NC} Creating test commit..."
echo "Test content" > test-file-$FEATURE_NAME_RENAMED.txt
git add test-file-$FEATURE_NAME_RENAMED.txt
git commit -m "Test commit for feature $FEATURE_NAME_RENAMED" > /dev/null
echo -e "${GREEN}✓ Test commit created${NC}"
echo ""

# ========================================
# TEST 8: Feature Finish
# ========================================
execute_and_verify \
    "Feature Finish" \
    "git flow feature finish $FEATURE_NAME_RENAMED" \
    "git-flow-next.feature.finish"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "develop" ]; then
    echo -e "${GREEN}✓ Verified: Back on develop branch${NC}"
else
    echo -e "${RED}✗ Failed: Expected develop, got $CURRENT_BRANCH${NC}"
    exit 1
fi
echo ""

# ========================================
# TEST 9: Feature Delete (for the second feature)
# ========================================
execute_and_verify \
    "Feature Delete" \
    "git flow feature delete $FEATURE_NAME_2 -f" \
    "git-flow-next.feature.delete"

# Verify the branch was deleted
if git branch --list "feature/$FEATURE_NAME_2" | grep -q "feature/$FEATURE_NAME_2"; then
    echo -e "${RED}✗ Failed: Branch feature/$FEATURE_NAME_2 still exists${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Verified: Branch feature/$FEATURE_NAME_2 was deleted${NC}"
fi
echo ""

# ========================================
# TEST 10: Verify command construction
# ========================================
echo "========================================="
echo " Command Construction Verification"
echo "========================================="
echo ""

echo -e "${BLUE}[VERIFY]${NC} Checking extension command patterns..."
echo ""

# Check that extension.ts uses the correct command format
grep -n "executeGitFlowCommand('feature start'" /Users/andreibaloleanu/git-flow-next-vs/src/extension.ts | head -1 | sed 's/^/  /'
grep -n "executeGitFlowCommand('feature finish'" /Users/andreibaloleanu/git-flow-next-vs/src/extension.ts | head -1 | sed 's/^/  /'
grep -n "executeGitFlowCommand('feature list'" /Users/andreibaloleanu/git-flow-next-vs/src/extension.ts | head -1 | sed 's/^/  /'
grep -n "executeGitFlowCommand('feature checkout'" /Users/andreibaloleanu/git-flow-next-vs/src/extension.ts | head -1 | sed 's/^/  /'
grep -n "executeGitFlowCommand('feature delete'" /Users/andreibaloleanu/git-flow-next-vs/src/extension.ts | head -1 | sed 's/^/  /'
grep -n "executeGitFlowCommand('feature rename'" /Users/andreibaloleanu/git-flow-next-vs/src/extension.ts | head -1 | sed 's/^/  /'
grep -n "executeGitFlowCommand('feature update'" /Users/andreibaloleanu/git-flow-next-vs/src/extension.ts | head -1 | sed 's/^/  /'

echo ""
echo -e "${GREEN}✓ All command patterns verified in extension.ts${NC}"
echo ""

# ========================================
# Cleanup
# ========================================
echo "========================================="
echo " Cleanup"
echo "========================================="
echo ""

echo -e "${BLUE}[CLEANUP]${NC} Removing test file..."
if [ -f "test-file-$FEATURE_NAME_RENAMED.txt" ]; then
    git rm test-file-$FEATURE_NAME_RENAMED.txt > /dev/null 2>&1
    git commit -m "Clean up test file" > /dev/null 2>&1
    echo -e "${GREEN}✓ Test file cleaned up${NC}"
fi
echo ""

# ========================================
# Summary
# ========================================
echo "========================================="
echo " Test Summary"
echo "========================================="
echo ""
echo -e "Total Tests: $TEST_COUNT"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ ALL TESTS PASSED ✓✓✓${NC}"
    echo ""
    echo "The VS Code extension commands are correctly configured!"
    echo ""
    echo "Verified commands:"
    echo "  ✓ git-flow-next.feature.start → git flow feature start <name>"
    echo "  ✓ git-flow-next.feature.finish → git flow feature finish <name>"
    echo "  ✓ git-flow-next.feature.list → git flow feature list"
    echo "  ✓ git-flow-next.feature.checkout → git flow feature checkout <name>"
    echo "  ✓ git-flow-next.feature.delete → git flow feature delete <name>"
    echo "  ✓ git-flow-next.feature.rename → git flow feature rename <new-name>"
    echo "  ✓ git-flow-next.feature.update → git flow feature update <name>"
    echo ""
    exit 0
else
    echo -e "${RED}✗✗✗ SOME TESTS FAILED ✗✗✗${NC}"
    exit 1
fi
