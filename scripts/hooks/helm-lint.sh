#!/bin/bash
# Helm chart linting hook
set -e

echo "⛵ Linting Helm charts..."

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo "Installing Helm..."
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# Check if kubeval is installed for template validation
if ! command -v kubeval &> /dev/null; then
    echo "Installing kubeval for template validation..."
    curl -L https://github.com/instrumenta/kubeval/releases/latest/download/kubeval-$(uname -s | tr '[:upper:]' '[:lower:]')-amd64.tar.gz | tar xz
    sudo mv kubeval /usr/local/bin/
fi

violations=0

# Find and lint all Helm charts
if [ -d "k8s/helm/" ]; then
    find k8s/helm/ -name "Chart.yaml" -exec dirname {} \; | while read -r chart_dir; do
        chart_name=$(basename "$chart_dir")
        echo "Linting Helm chart: $chart_name"
        
        # Lint the chart
        if helm lint "$chart_dir"; then
            echo "✅ Helm lint passed for $chart_name"
        else
            echo "❌ Helm lint failed for $chart_name"
            violations=$((violations + 1))
        fi
        
        # Template and validate with kubeval
        echo "Templating and validating $chart_name..."
        for values_file in "$chart_dir/values.yaml" "$chart_dir/values-staging.yaml" "$chart_dir/values-prod.yaml"; do
            if [ -f "$values_file" ]; then
                values_name=$(basename "$values_file" .yaml)
                echo "Using values file: $values_name"
                
                if helm template "$chart_name" "$chart_dir" --values "$values_file" | kubeval; then
                    echo "✅ Template validation passed for $chart_name with $values_name"
                else
                    echo "❌ Template validation failed for $chart_name with $values_name"
                    violations=$((violations + 1))
                fi
            fi
        done
    done
    
    # Check if any violations were found
    if [ $violations -gt 0 ]; then
        echo "❌ Helm chart validation failed with $violations violations"
        exit 1
    else
        echo "✅ All Helm charts passed validation"
    fi
else
    echo "📝 No Helm charts found to validate"
fi