change_ts_hint_length() {
  directory_path=$(which code)
  new_length="$1"

  if [ -z "$1" ]
    then
      echo "No length supplied, will use default (160)"
      new_length=160
  fi

  file_path=$(find "$directory_path" -name "tsserver.js" 2>/dev/null)
  if [ -z "$file_path" ]; then
    echo "tsserver.js file not found within directory $directory_path after recursive search"
    exit 1
  fi
  awk -v new_length="$new_length" '{sub(/var defaultMaximumTruncationLength = [0-9]+;/, "var defaultMaximumTruncationLength = " new_length ";")}1' "$file_path" > temp_file && mv temp_file "$file_path"

  echo "Length updated successfully: "
  cat "$file_path" | grep "defaultMaximumTruncationLength = "

}

alias tslen="change_ts_hint_length"