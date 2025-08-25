#!/bin/bash
# Setup script for pre-commit hooks
set -e

echo "🚀 Setting up pre-commit hooks for Link project..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    
    # Try different installation methods based on platform
    if command -v pip3 &> /dev/null; then
        pip3 install pre-commit
    elif command -v pip &> /dev/null; then
        pip install pre-commit
    elif command -v brew &> /dev/null; then
        brew install pre-commit
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y pre-commit
    elif command -v yum &> /dev/null; then
        sudo yum install -y pre-commit
    else
        echo "❌ Could not install pre-commit automatically"
        echo "Please install pre-commit manually: https://pre-commit.com/#installation"
        exit 1
    fi
fi

echo "✅ pre-commit is available"

# Install the pre-commit hooks
echo "Installing pre-commit hooks..."
pre-commit install

# Install commit-msg hook for conventional commits
echo "Installing commit-msg hook..."
pre-commit install --hook-type commit-msg

# Initialize secrets baseline if it doesn't exist
if [ ! -f ".secrets.baseline" ]; then
    echo "Creating secrets baseline..."
    if command -v detect-secrets &> /dev/null; then
        detect-secrets scan --baseline .secrets.baseline
    else
        echo "⚠️  detect-secrets not found, creating empty baseline"
        echo '{}' > .secrets.baseline
    fi
fi

# Create .pre-commit-cache directory if it doesn't exist
mkdir -p .git/hooks

# Set up environment for hooks
echo "Setting up hook environment..."

# Check for required tools and provide installation guidance
echo "🔧 Checking for required tools..."

tools_to_check=(
    "go:Go programming language:https://golang.org/doc/install"
    "node:Node.js:https://nodejs.org/"
    "npm:npm package manager:https://www.npmjs.com/"
    "docker:Docker:https://docs.docker.com/get-docker/"
    "helm:Helm:https://helm.sh/docs/intro/install/"
    "kubeval:kubeval:https://github.com/instrumenta/kubeval"
    "kubeconform:kubeconform:https://github.com/yannh/kubeconform"
    "conftest:Conftest:https://github.com/open-policy-agent/conftest"
)

missing_tools=()
for tool_info in "${tools_to_check[@]}"; do
    IFS=':' read -r tool_name tool_description tool_url <<< "$tool_info"
    
    if command -v "$tool_name" &> /dev/null; then
        echo "✅ $tool_description is installed"
    else
        echo "⚠️  $tool_description is not installed"
        missing_tools+=("$tool_name:$tool_description:$tool_url")
    fi
done

# Install frontend dependencies if package.json exists
if [ -f "frontend/package.json" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    echo "✅ Frontend dependencies installed"
fi

# Install Go dependencies for backend services
echo "Installing Go dependencies..."
if [ -f "backend/go.work" ]; then
    cd backend
    go work sync
    echo "✅ Go workspace synced"
    cd ..
fi

# Run initial validation to ensure everything works
echo "🧪 Running initial validation..."
if pre-commit run --all-files; then
    echo "✅ Initial validation passed"
else
    echo "⚠️  Some validation checks failed"
    echo "💡 This is normal for the first run. Run 'pre-commit run --all-files' to see specific issues"
fi

echo ""
echo "🎉 Pre-commit hooks setup complete!"
echo ""
echo "📋 Summary:"
echo "- Pre-commit hooks are now installed and will run on every commit"
echo "- Hooks will validate code formatting, linting, tests, and security policies"
echo "- To run hooks manually: pre-commit run --all-files"
echo "- To update hooks: pre-commit autoupdate"
echo "- To skip hooks (not recommended): git commit --no-verify"
echo ""

if [ ${#missing_tools[@]} -gt 0 ]; then
    echo "⚠️  Missing tools that will enhance validation:"
    for tool_info in "${missing_tools[@]}"; do
        IFS=':' read -r tool_name tool_description tool_url <<< "$tool_info"
        echo "   - $tool_description: $tool_url"
    done
    echo ""
fi

echo "💡 Tips:"
echo "- Commit messages should follow conventional commit format (feat:, fix:, docs:, etc.)"
echo "- Large files and secrets will be blocked automatically"
echo "- Kubernetes manifests and Helm charts are validated on every commit"
echo "- Backend services are tested when Go files change"
echo "- Frontend code is type-checked and tested when TypeScript files change"
echo ""
echo "For more information, see: .pre-commit-config.yaml"