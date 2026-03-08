/*
  # Enhanced Validation Schema for LCD Compliance

  1. Updates to validation_history table
    - Add comprehensive result fields for LCD validation
    - Add file processing metadata
    - Add detailed compliance scoring

  2. New fields for LCD validation results
    - overall_score: Overall compliance percentage
    - lcd_results: Detailed results per LCD
    - recommendations: Specific improvement suggestions
    - compliance_summary: High-level compliance status
    - processing_metadata: File extraction and processing info
*/

-- Add new columns to validation_history table for enhanced LCD validation
DO $$
BEGIN
  -- Add overall_score column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'overall_score'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN overall_score integer DEFAULT 0;
  END IF;

  -- Add lcd_results column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'lcd_results'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN lcd_results jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add recommendations column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'recommendations'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN recommendations jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add compliance_summary column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'compliance_summary'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN compliance_summary text;
  END IF;

  -- Add processing_metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'processing_metadata'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN processing_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add mac_contractor column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'mac_contractor'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN mac_contractor text;
  END IF;

  -- Add applicable_lcds column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'applicable_lcds'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN applicable_lcds text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_validation_history_overall_score ON validation_history(overall_score);
CREATE INDEX IF NOT EXISTS idx_validation_history_status_created ON validation_history(status, created_at);

-- Add sample data structure comment for reference
COMMENT ON COLUMN validation_history.lcd_results IS 'Array of LCD validation results: [{"lcd": "L35041", "status": "pass|fail|warning", "score": 85, "details": "...", "missing_elements": []}]';
COMMENT ON COLUMN validation_history.recommendations IS 'Array of improvement recommendations: [{"category": "documentation", "priority": "high", "suggestion": "Add wound measurements"}]';
COMMENT ON COLUMN validation_history.processing_metadata IS 'File processing info: {"word_count": 450, "extraction_method": "docx", "processing_time_ms": 1200}';