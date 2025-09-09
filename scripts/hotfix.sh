#!/bin/bash

# Hotfix Management Script
# Creates, manages, and deploys hotfixes for critical production issues

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat << EOF
🚨 Hotfix Management Script

USAGE:
    $0 <command> [options]

COMMANDS:
    create      Create a new hotfix branch from main
    deploy      Deploy existing hotfix to production  
    status      Show status of active hotfixes
    finish      Merge hotfix back and cleanup
    help        Show this help message

EXAMPLES:
    # Create new hotfix
    $0 create --name "payment-bug" --severity critical --reason "Payment processing broken"
    
    # Deploy existing hotfix  
    $0 deploy --branch "hotfix/security-patch" --severity critical
    
    # Check hotfix status
    $0 status
    
    # Finish hotfix (merge back)
    $0 finish --branch "hotfix/payment-bug"

SEVERITY LEVELS:
    critical    Production down, security breach (immediate deployment)
    high        Major functionality broken (expedited deployment)  
    medium      Important fix needed (standard review process)

EOF
}

create_hotfix() {
    local name=""
    local severity="critical"
    local reason=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --name)
                name="$2"
                shift 2
                ;;
            --severity)
                severity="$2"
                shift 2
                ;;
            --reason)
                reason="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Validate inputs
    if [[ -z "$name" ]]; then
        log_error "Hotfix name is required (--name)"
        echo "Example: --name 'payment-bug'"
        exit 1
    fi
    
    if [[ -z "$reason" ]]; then
        log_error "Reason is required (--reason)"
        echo "Example: --reason 'Payment processing completely broken'"
        exit 1
    fi
    
    # Validate severity
    case $severity in
        critical|high|medium) ;;
        *)
            log_error "Invalid severity: $severity"
            echo "Valid options: critical, high, medium"
            exit 1
            ;;
    esac
    
    local branch_name="hotfix/${name}"
    
    log_info "Creating hotfix branch: $branch_name"
    
    # Ensure we're on main and up to date
    log_info "Switching to main branch and updating..."
    git checkout main
    git pull origin main
    
    # Create hotfix branch
    log_info "Creating hotfix branch from main..."
    git checkout -b "$branch_name"
    
    # Push branch to remote
    log_info "Pushing hotfix branch to remote..."
    git push -u origin "$branch_name"
    
    log_success "Hotfix branch created successfully!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Make your hotfix changes in this branch"
    echo "2. Test the changes thoroughly"  
    echo "3. Commit and push your changes"
    echo "4. Deploy with: $0 deploy --branch $branch_name --severity $severity"
    echo ""
    echo "🚨 Hotfix Details:"
    echo "• Branch: $branch_name"
    echo "• Severity: $severity"
    echo "• Reason: $reason"
    echo "• Current branch: $(git branch --show-current)"
}

deploy_hotfix() {
    local branch=""
    local severity="critical"
    local reason="Emergency hotfix deployment"
    local skip_tests="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --branch)
                branch="$2"
                shift 2
                ;;
            --severity)
                severity="$2"
                shift 2
                ;;
            --reason)
                reason="$2"
                shift 2
                ;;
            --skip-tests)
                skip_tests="true"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    if [[ -z "$branch" ]]; then
        log_error "Branch is required (--branch)"
        echo "Example: --branch 'hotfix/payment-bug'"
        exit 1
    fi
    
    log_warning "🚨 HOTFIX DEPLOYMENT WARNING"
    echo "=============================="
    echo "You are about to deploy a hotfix directly to production!"
    echo ""
    echo "Branch: $branch"
    echo "Severity: $severity"
    echo "Reason: $reason"
    echo "Skip tests: $skip_tests"
    echo ""
    
    read -p "Are you sure you want to proceed? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
    
    log_info "Triggering hotfix deployment workflow..."
    
    # Trigger GitHub workflow
    gh workflow run hotfix-pipeline.yml \
        -f hotfix_branch="$branch" \
        -f severity="$severity" \
        -f reason="$reason" \
        -f skip_tests="$skip_tests"
    
    log_success "Hotfix deployment workflow triggered!"
    echo ""
    echo "📊 Monitor deployment:"
    echo "• GitHub Actions: $(gh repo view --web)/actions/workflows/hotfix-pipeline.yml"
    echo "• Workflow logs: gh run list --workflow hotfix-pipeline.yml"
    echo ""
    echo "⏱️ Expected deployment time:"
    case $severity in
        critical) echo "• Critical: ~5-10 minutes" ;;
        high) echo "• High: ~10-15 minutes" ;;
        medium) echo "• Medium: ~15-20 minutes" ;;
    esac
}

hotfix_status() {
    log_info "Checking hotfix status..."
    
    # Check for active hotfix branches
    echo ""
    echo "🌿 Active Hotfix Branches:"
    echo "========================="
    
    local hotfix_branches
    hotfix_branches=$(git branch -r | grep "origin/hotfix/" | sed 's|origin/||' | head -10)
    
    if [[ -z "$hotfix_branches" ]]; then
        echo "No active hotfix branches found."
    else
        echo "$hotfix_branches"
    fi
    
    echo ""
    echo "🔄 Recent Hotfix Workflows:"
    echo "=========================="
    
    # Show recent hotfix workflow runs
    if command -v gh >/dev/null 2>&1; then
        gh run list --workflow hotfix-pipeline.yml --limit 5 || echo "No recent hotfix workflows found"
    else
        echo "Install GitHub CLI (gh) to see workflow status"
    fi
    
    echo ""
    echo "🎯 Current Branch:"
    echo "=================="
    echo "$(git branch --show-current)"
    
    # Check if current branch is a hotfix branch
    current_branch=$(git branch --show-current)
    if [[ "$current_branch" =~ ^hotfix/ ]]; then
        echo ""
        log_warning "You are currently on a hotfix branch!"
        echo "Use '$0 deploy --branch $current_branch --severity <level>' to deploy"
    fi
}

finish_hotfix() {
    local branch=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --branch)
                branch="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    if [[ -z "$branch" ]]; then
        # Try to detect if we're on a hotfix branch
        current_branch=$(git branch --show-current)
        if [[ "$current_branch" =~ ^hotfix/ ]]; then
            branch="$current_branch"
            log_info "Using current branch: $branch"
        else
            log_error "Branch is required (--branch)"
            echo "Example: --branch 'hotfix/payment-bug'"
            exit 1
        fi
    fi
    
    log_info "Finishing hotfix: $branch"
    
    # Merge to main
    log_info "Merging hotfix to main..."
    git checkout main
    git pull origin main
    git merge --no-ff "$branch" -m "Merge $branch into main"
    git push origin main
    
    # Merge to develop
    log_info "Merging hotfix to develop..."
    git checkout develop
    git pull origin develop  
    git merge --no-ff "$branch" -m "Merge $branch into develop"
    git push origin develop
    
    # Delete hotfix branch
    log_info "Cleaning up hotfix branch..."
    git branch -d "$branch"
    git push origin --delete "$branch"
    
    log_success "Hotfix finished successfully!"
    echo ""
    echo "✅ Completed actions:"
    echo "• Merged $branch to main"
    echo "• Merged $branch to develop" 
    echo "• Deleted hotfix branch"
    echo "• Updated remote repositories"
    echo ""
    echo "📋 Post-hotfix checklist:"
    echo "• Monitor production metrics"
    echo "• Schedule post-incident review"
    echo "• Update documentation/runbooks"
    echo "• Notify stakeholders of resolution"
}

# Main script logic
case "${1:-}" in
    create)
        shift
        create_hotfix "$@"
        ;;
    deploy)
        shift
        deploy_hotfix "$@"
        ;;
    status)
        hotfix_status
        ;;
    finish)
        shift
        finish_hotfix "$@"
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        if [[ $# -eq 0 ]]; then
            show_usage
        else
            log_error "Unknown command: ${1:-}"
            echo ""
            show_usage
        fi
        exit 1
        ;;
esac