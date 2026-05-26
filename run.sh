#!/bin/bash

# Canonical orchestrator script for AuraFlow-Clinical
# Scaffolds the initial monorepo base utilizing Elata standards

echo "Scaffolding AuraFlow-Clinical with @elata-biosciences/create-elata-demo..."
npx -y @elata-biosciences/create-elata-demo@latest ./
