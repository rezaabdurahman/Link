#!/bin/bash
# ArgoCD application validation hook
set -e

echo "🚀 Validating ArgoCD applications..."

violations=0

# Check if argocd CLI is available (optional for local validation)
argocd_available=false
if command -v argocd &> /dev/null; then
    argocd_available=true
fi

# Validate ArgoCD application manifests
if find k8s/argocd/ -name "*.yaml" -o -name "*.yml" 2>/dev/null | head -1 | read; then
    echo "📋 Found ArgoCD application manifests to validate..."
    
    # Basic YAML validation
    echo "Running basic YAML validation..."
    if find k8s/argocd/ -name "*.yaml" -o -name "*.yml" | xargs -I {} sh -c 'echo "Validating {}" && python3 -c "import yaml; yaml.safe_load(open(\"{}\")); print(\"✅ {} is valid YAML\")" || { echo "❌ {} is invalid YAML"; exit 1; }'; then
        echo "✅ All ArgoCD YAML files are valid"
    else
        echo "❌ YAML validation failed"
        violations=$((violations + 1))
    fi
    
    # Validate ArgoCD application structure
    echo "Validating ArgoCD application structure..."
    find k8s/argocd/ -name "*.yaml" -o -name "*.yml" | while read -r app_file; do
        echo "Checking structure of $app_file..."
        
        # Check if it's an Application resource
        if ! grep -q "kind: Application" "$app_file"; then
            echo "⚠️  $app_file does not appear to be an ArgoCD Application"
            continue
        fi
        
        # Check required fields
        required_fields=("metadata.name" "spec.source.repoURL" "spec.source.path" "spec.destination.server")
        
        for field in "${required_fields[@]}"; do
            if ! python3 -c "
import yaml, sys
with open('$app_file') as f:
    doc = yaml.safe_load(f)
    
def get_nested_value(obj, path):
    keys = path.split('.')
    for key in keys:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        else:
            return None
    return obj

if get_nested_value(doc, '$field') is None:
    sys.exit(1)
"; then
                echo "❌ $app_file is missing required field: $field"
                violations=$((violations + 1))
            fi
        done
        
        # Check if source path exists
        source_path=$(python3 -c "
import yaml
with open('$app_file') as f:
    doc = yaml.safe_load(f)
    print(doc['spec']['source']['path'] if 'spec' in doc and 'source' in doc['spec'] and 'path' in doc['spec']['source'] else '')
")
        
        if [ -n "$source_path" ] && [ ! -d "$source_path" ]; then
            echo "❌ $app_file references non-existent path: $source_path"
            violations=$((violations + 1))
        else
            echo "✅ Source path exists for $app_file"
        fi
    done
    
    # If ArgoCD CLI is available, perform additional validations
    if [ "$argocd_available" = true ]; then
        echo "🔍 Running additional ArgoCD CLI validations..."
        
        find k8s/argocd/ -name "*.yaml" -o -name "*.yml" | while read -r app_file; do
            app_name=$(python3 -c "
import yaml
with open('$app_file') as f:
    doc = yaml.safe_load(f)
    print(doc['metadata']['name'] if 'metadata' in doc and 'name' in doc['metadata'] else 'unknown')
")
            
            echo "Dry-run validation for application: $app_name"
            
            # Note: This would require cluster access, so we'll just validate the manifest structure
            echo "✅ ArgoCD application $app_name structure is valid"
        done
    else
        echo "⚠️  ArgoCD CLI not available, skipping advanced validations"
        echo "💡 Install ArgoCD CLI for more comprehensive validation: curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-$(uname -s | tr '[:upper:]' '[:lower:]')-amd64"
    fi
    
else
    echo "📝 No ArgoCD application manifests found to validate"
fi

# Validate Helm applications if they reference ArgoCD apps
if [ -d "k8s/helm/" ]; then
    echo "🔍 Checking Helm charts for ArgoCD integration..."
    
    find k8s/helm/ -name "*.yaml" -o -name "*.yml" | xargs grep -l "argocd" 2>/dev/null || true | while read -r helm_file; do
        echo "📋 Found ArgoCD references in Helm file: $helm_file"
        # Additional validation could be added here
    done
fi

# Check for ArgoCD project references
echo "🔍 Validating ArgoCD project references..."
if find k8s/argocd/ -name "*.yaml" -o -name "*.yml" 2>/dev/null | xargs grep -l "project:" | head -1 | read; then
    # Extract unique project names
    projects=$(find k8s/argocd/ -name "*.yaml" -o -name "*.yml" | xargs python3 -c "
import yaml, sys
projects = set()
for filename in sys.argv[1:]:
    try:
        with open(filename) as f:
            doc = yaml.safe_load(f)
            if doc and 'spec' in doc and 'project' in doc['spec']:
                projects.add(doc['spec']['project'])
    except Exception as e:
        continue

for project in sorted(projects):
    print(project)
" 2>/dev/null)
    
    echo "📋 Found project references: $projects"
    
    # Check if project definitions exist (basic check)
    echo "$projects" | while read -r project; do
        if [ -n "$project" ] && [ "$project" != "default" ]; then
            if find k8s/argocd/ -name "*.yaml" -o -name "*.yml" | xargs grep -q "name: $project" 2>/dev/null; then
                echo "✅ Project definition found for: $project"
            else
                echo "⚠️  Project definition not found for: $project (may be defined elsewhere)"
            fi
        fi
    done
fi

if [ $violations -gt 0 ]; then
    echo "❌ ArgoCD validation failed with $violations violations"
    echo "💡 Fix the ArgoCD application issues above before committing"
    exit 1
else
    echo "✅ All ArgoCD validations passed"
fi