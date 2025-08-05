import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { url1, url2 } = await request.json();

    if (!url1 || !url2) {
      return NextResponse.json(
        { error: "Missing url1 or url2" },
        { status: 400 }
      );
    }

    // Path to the Python script
    const scriptPath = path.join(process.cwd(), "scripts", "compare_artwork.py");
    
    // Prepare input data
    const inputData = JSON.stringify({ url1, url2 });
    
    try {
      // Execute Python script with proper stdin handling
      const { stdout, stderr } = await execAsync(
        `echo '${inputData.replace(/'/g, "'\\''")}' | python3 "${scriptPath}"`,
        {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024, // 1MB buffer
          timeout: 30000 // 30 second timeout
        }
      );

      if (stderr && !stderr.includes("Error downloading image")) {
        console.warn("Python script warnings:", stderr);
      }

      // Parse the result
      const result = JSON.parse(stdout);
      
      return NextResponse.json(result);
      
    } catch (error) {
      console.error("Error executing Python script:", error);
      
      // Check if Python dependencies are missing
      if (error instanceof Error && error.message.includes("ModuleNotFoundError")) {
        return NextResponse.json(
          { 
            error: "Python dependencies not installed. Run: pip install -r scripts/requirements.txt",
            similarity: 0.0 
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to compare images", similarity: 0.0 },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Invalid request", similarity: 0.0 },
      { status: 400 }
    );
  }
}