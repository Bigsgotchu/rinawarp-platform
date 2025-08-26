#!/bin/bash

# Update service imports
find . -type f -name "*.ts" -exec sed -i '' \
  -e 's/from ['"'"'"]\.\.\/services\/[A-Z][^'"'"'"]*Service['"'"'"]/from '"'"'..\/services\/command'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/services\/Analytics/from '"'"'..\/services\/analytics'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/services\/Auth/from '"'"'..\/services\/auth'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/services\/Billing/from '"'"'..\/services\/billing'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/services\/Email/from '"'"'..\/services\/email'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/services\/Monitoring/from '"'"'..\/services\/monitoring'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/services\/Stripe/from '"'"'..\/services\/stripe'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/services\/User/from '"'"'..\/services\/user'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/services\/Workflow/from '"'"'..\/services\/workflow'"'"'/g' {} \;

# Update controller imports
find . -type f -name "*.ts" -exec sed -i '' \
  -e 's/from ['"'"'"]\.\.\/controllers\/[A-Z][^'"'"'"]*Controller['"'"'"]/from '"'"'..\/controllers\/command'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/controllers\/Analytics/from '"'"'..\/controllers\/analytics'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/controllers\/Auth/from '"'"'..\/controllers\/auth'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/controllers\/Command/from '"'"'..\/controllers\/command'"'"'/g' \
  -e 's/from ['"'"'"]\.\.\/controllers\/User/from '"'"'..\/controllers\/user'"'"'/g' {} \;

# Update type imports
find . -type f -name "*.ts" -exec sed -i '' \
  -e 's/from ['"'"'"]\.\.\/types\/[a-z]/from '"'"'..\/types'"'"'/g' {} \;
