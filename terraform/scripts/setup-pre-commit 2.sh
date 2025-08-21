#!/bin/bash

# Pre-commit Setup Script
# Installs and configures pre-commit hooks for Terraform quality gates

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}"
}

# Check if Python is available
check_python() {
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not found"
        log_info "Install Python 3: https://www.python.org/downloads/"
        exit 1
    fi
    
    log_info "✅ Python 3 found: $(python3 --version)"
}

# Check if pip is available
check_pip() {
    if ! command -v pip3 &> /dev/null; then
        log_error "pip3 is required but not found"
        log_info "Install pip3: https://pip.pypa.io/en/stable/installation/"
        exit 1
    fi
    
    log_info "✅ pip3 found: $(pip3 --version)"
}

# Install pre-commit
install_precommit() {
    log_section "Installing pre-commit"
    
    if command -v pre-commit &> /dev/null; then
        log_info "pre-commit already installed: $(pre-commit --version)"
    else
        log_info "Installing pre-commit..."
        pip3 install --user pre-commit
        
        # Add to PATH if needed
        if ! command -v pre-commit &> /dev/null; then
            export PATH="$HOME/.local/bin:$PATH"
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
            log_info "Added ~/.local/bin to PATH"
        fi
        
        log_info "✅ pre-commit installed: $(pre-commit --version)"
    fi
}

# Install Terraform tools
install_terraform_tools() {
    log_section "Installing Terraform Tools"
    
    # Check for Homebrew on macOS
    if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &> /dev/null; then
        log_info "Installing tools via Homebrew..."
        
        local tools=("terraform" "tflint" "tfsec" "terraform-docs")
        for tool in "${tools[@]}"; do
            if command -v "$tool" &> /dev/null; then
                log_info "✅ $tool already installed"
            else
                log_info "Installing $tool..."
                brew install "$tool"
            fi
        done
    else
        log_warn "Homebrew not found or not on macOS"
        log_info "Please install the following tools manually:"
        log_info "  - terraform: https://www.terraform.io/downloads.html"
        log_info "  - tflint: https://github.com/terraform-linters/tflint"
        log_info "  - tfsec: https://github.com/aquasecurity/tfsec"
        log_info "  - terraform-docs: https://github.com/terraform-docs/terraform-docs"
    fi
}

# Install additional tools via pip
install_python_tools() {
    log_section "Installing Python Tools"
    
    local tools=("checkov" "pre-commit-hooks")
    for tool in "${tools[@]}"; do
        log_info "Installing $tool..."
        pip3 install --user "$tool"
    done
    
    log_info "✅ Python tools installed"
}

# Install pre-commit hooks
install_hooks() {
    log_section "Installing Pre-commit Hooks"
    
    cd "$TERRAFORM_DIR"
    
    if [ ! -f ".pre-commit-config.yaml" ]; then
        log_error ".pre-commit-config.yaml not found"
        exit 1
    fi
    
    log_info "Installing pre-commit hooks..."
    pre-commit install
    pre-commit install --hook-type commit-msg
    
    log_info "✅ Pre-commit hooks installed"
}

# Test the hooks
test_hooks() {
    log_section "Testing Pre-commit Hooks"
    
    cd "$TERRAFORM_DIR"
    
    log_info "Running pre-commit on all files..."
    if pre-commit run --all-files; then
        log_info "✅ All hooks passed"
    else
        log_warn "⚠️  Some hooks failed or made changes"
        log_info "This is normal for the first run - hooks may auto-fix issues"
    fi
}

# Create helper scripts
create_helper_scripts() {
    log_section "Creating Helper Scripts"
    
    # Create update script
    cat > "$TERRAFORM_DIR/scripts/update-pre-commit.sh" << 'EOF'
#!/bin/bash
# Update pre-commit hooks to latest versions

set -euo pipefail

echo "Updating pre-commit hooks..."
pre-commit autoupdate

echo "Running updated hooks on all files..."
pre-commit run --all-files

echo "✅ Pre-commit hooks updated and tested"
EOF

    chmod +x "$TERRAFORM_DIR/scripts/update-pre-commit.sh"
    
    # Create bypass script for emergencies
    cat > "$TERRAFORM_DIR/scripts/commit-bypass.sh" << 'EOF'
#!/bin/bash
# Emergency commit bypass (use sparingly!)

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 <commit message>"
    echo "Example: $0 \"emergency fix - bypass hooks\""
    exit 1
fi

echo "⚠️  Bypassing pre-commit hooks"
echo "Commit message: $1"

git commit --no-verify -m "$1"

echo "✅ Commit completed (hooks bypassed)"
echo "Remember to fix any issues in the next commit!"
EOF

    chmod +x "$TERRAFORM_DIR/scripts/commit-bypass.sh"
    
    log_info "✅ Helper scripts created"
}

# Print usage instructions
print_usage() {
    log_section "Usage Instructions"
    
    echo "Pre-commit hooks are now set up! Here's what you need to know:"
    echo ""
    echo "📋 What happens now:"
    echo "  • Every git commit will run quality checks automatically"
    echo "  • Hooks will format code, validate Terraform, and scan for security issues"
    echo "  • If checks fail, the commit will be rejected"
    echo ""
    echo "🛠️  Common commands:"
    echo "  pre-commit run --all-files     # Run hooks on all files"
    echo "  pre-commit run terraform_fmt   # Run specific hook"
    echo "  git commit --no-verify         # Bypass hooks (emergency only)"
    echo ""
    echo "📁 Helper scripts:"
    echo "  ./scripts/update-pre-commit.sh # Update hooks to latest versions"
    echo "  ./scripts/commit-bypass.sh     # Emergency commit bypass"
    echo ""
    echo "🔧 Configuration files:"
    echo "  .pre-commit-config.yaml        # Hook configuration"
    echo "  .tflint.hcl                   # TFLint configuration"
    echo "  .tfsec.yml                    # TFSec configuration"
    echo ""
    echo "📚 More info: https://pre-commit.com/"
}

# Main execution
main() {
    log_info "Setting up pre-commit hooks for Terraform..."
    
    check_python
    check_pip
    install_precommit
    install_terraform_tools
    install_python_tools
    install_hooks
    test_hooks
    create_helper_scripts
    print_usage
    
    log_info "🎉 Pre-commit setup completed successfully!"
}

# Print usage if requested
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Usage: $0 [--help]"
    echo ""
    echo "Sets up pre-commit hooks for Terraform quality gates."
    echo ""
    echo "This script will:"
    echo "  1. Install pre-commit (if not already installed)"
    echo "  2. Install required Terraform tools (terraform, tflint, tfsec, etc.)"
    echo "  3. Install Python-based tools (checkov)"
    echo "  4. Install and configure pre-commit hooks"
    echo "  5. Test the hooks on existing files"
    echo "  6. Create helper scripts for maintenance"
    echo ""
    echo "Prerequisites:"
    echo "  - Python 3 and pip3"
    echo "  - Git repository"
    echo "  - Homebrew (for macOS users)"
    exit 0
fi

# Execute main function
main "$@"