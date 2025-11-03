#!/bin/bash

# Script to update impl: function signatures from (ctx, {PARAMS}) to (ctx, {}, {PARAMS})

echo "Updating impl: function signatures..."

# Find all files containing "impl: (" and apply the transformation
grep -r -l "impl: (" . --exclude="*.sh" --exclude-dir=node_modules --exclude-dir=.git | while read file; do
    echo "Processing: $file"
    
    # Use sed to replace the pattern
    # This regex matches: impl: (ctx, {anything}) =>
    # And replaces with: impl: (ctx, {}, {anything}) =>
    sed -i 's/impl: (\([^,]*\), {\([^}]*\)}) =>/impl: (\1, {}, {\2}) =>/g' "$file"
done

echo "Transformation complete!"
echo "Verifying changes..."

# Count the updated patterns
new_count=$(grep -r "impl: (.*{}, {" . --exclude="*.sh" --exclude-dir=node_modules --exclude-dir=.git | wc -l)
old_count=$(grep -r "impl: (.*{[^}].*})" . --exclude="*.sh" --exclude-dir=node_modules --exclude-dir=.git | grep -v "{}, {" | wc -l)

echo "Files with new pattern (impl: (ctx, {}, {PARAMS})): $new_count"
echo "Files still with old pattern: $old_count"
