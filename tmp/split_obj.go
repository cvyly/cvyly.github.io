package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run split_obj.go <path_to_obj>")
		return
	}

	objPath := os.Args[1]
	baseDir := filepath.Dir(objPath)
	file, err := os.Open(objPath)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	defer file.Close()

	const maxSizeBytes = 90 * 1024 * 1024 // 90MB target
	var partIndex = 1
	var currentSizeBytes int64 = 0
	
	outPath := filepath.Join(baseDir, fmt.Sprintf("terrain_part%d.obj", partIndex))
	outFile, _ := os.Create(outPath)
	writer := bufio.NewWriter(outFile)

	scanner := bufio.NewScanner(file)
	// Larger buffer for big OBJ files
	buf := make([]byte, 1024*1024)
	scanner.Buffer(buf, 10*1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		lineLen := int64(len(line) + 1) // +1 for newline

		if currentSizeBytes+lineLen > maxSizeBytes && strings.HasPrefix(line, "g ") {
			// Flush and close current part
			writer.Flush()
			outFile.Close()

			// Start next part
			partIndex++
			outPath = filepath.Join(baseDir, fmt.Sprintf("terrain_part%d.obj", partIndex))
			outFile, _ = os.Create(outPath)
			writer = bufio.NewWriter(outFile)
			currentSizeBytes = 0
			fmt.Printf("Created %s\n", outPath)
		}

		writer.WriteString(line + "\n")
		currentSizeBytes += lineLen
	}

	writer.Flush()
	outFile.Close()
	fmt.Printf("Finished splitting. Created %d parts.\n", partIndex)
}
