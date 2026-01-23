change_ts_hint_length() {
  # 1. Get the actual binary path and resolve symlinks
  local code_path
  code_path=$(readlink -f "$(which code)")
  
  # 2. Go up from the binary to the root of the VS Code installation
  # On Linux, code is usually in /usr/lib/code/bin/code or /usr/share/code/bin/code
  local base_dir
  base_dir=$(dirname "$(dirname "$code_path")")
  
  local new_length="${1:-160}"

  echo "Searching for tsserver.js in $base_dir..."

  # 3. Find the file
  local file_path
  file_path=$(find "$base_dir" -name "tsserver.js" 2>/dev/null | head -n 1)

  if [ -z "$file_path" ]; then
    echo "Error: tsserver.js not found in $base_dir"
    return 1 # Use return, not exit!
  fi

  # 4. Perform the update with sudo
  # We use a temp file in /tmp to avoid permission issues during the awk run
  echo "Updating truncation length to $new_length in $file_path"
  
  sudo awk -v len="$new_length" '{
    sub(/var defaultMaximumTruncationLength = [0-9]+;/, "var defaultMaximumTruncationLength = " len ";")
  }1' "$file_path" > /tmp/tsserver.js.tmp && \
  sudo mv /tmp/tsserver.js.tmp "$file_path"

  if [ $? -eq 0 ]; then
    echo "Length updated successfully!"
    grep "defaultMaximumTruncationLength =" "$file_path"
  else
    echo "Failed to move file. Do you have sudo permissions?"
    return 1
  fi
}

alias tslen="change_ts_hint_length"