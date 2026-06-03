use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize)]
pub struct JsonFile {
    pub name: String,
    pub content: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
pub struct TranslationGroupResult {
    #[serde(rename = "jsonFiles")]
    pub json_files: Vec<JsonFile>,
    #[serde(rename = "groupPrefix")]
    pub group_prefix: String,
    #[serde(rename = "dirPath")]
    pub dir_path: String,
}

#[derive(Serialize, Deserialize)]
pub struct WriteFileData {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub content: String,
    pub locale: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct WriteFilesResult {
    pub success: usize,
    pub failed: usize,
    pub total: usize,
}

#[tauri::command]
pub fn read_translation_group(selected_file_path: String) -> TranslationGroupResult {
    let path = PathBuf::from(&selected_file_path);
    let dir_path = path
        .parent()
        .unwrap_or(Path::new(""))
        .to_string_lossy()
        .to_string();
    let file_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let stem = file_name.trim_end_matches(".json");
    let parts: Vec<&str> = stem.split('.').collect();
    let (group_prefix, _locale) = if parts.len() >= 2 {
        (
            parts[..parts.len() - 1].join("."),
            parts[parts.len() - 1].to_string(),
        )
    } else {
        (String::new(), parts[0].to_string())
    };

    let mut json_files: Vec<JsonFile> = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir_path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".json") {
                continue;
            }

            let is_context = if group_prefix.is_empty() {
                name == "context.json"
            } else {
                name == format!("{}.context.json", group_prefix)
            };

            let is_group_match = if group_prefix.is_empty() {
                name.trim_end_matches(".json").split('.').count() == 1
            } else {
                name.starts_with(&format!("{}.", group_prefix))
                    && name != format!("{}.context.json", group_prefix)
            };

            if is_group_match || is_context {
                if let Ok(text) = fs::read_to_string(entry.path()) {
                    let content = if text.trim().is_empty() {
                        serde_json::Value::Object(Default::default())
                    } else if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                        parsed
                    } else {
                        continue;
                    };
                    json_files.push(JsonFile { name, content });
                }
            }
        }
    }

    TranslationGroupResult {
        json_files,
        group_prefix,
        dir_path,
    }
}

#[tauri::command]
pub fn translation_write_file(file_path: String, content: String) -> bool {
    fs::write(&file_path, &content).is_ok()
}

#[tauri::command]
pub fn translation_write_files(file_data_array: Vec<WriteFileData>) -> WriteFilesResult {
    let total = file_data_array.len();
    let mut success = 0;
    let mut failed = 0;
    for item in &file_data_array {
        if fs::write(&item.file_path, &item.content).is_ok() {
            success += 1;
        } else {
            failed += 1;
        }
    }
    WriteFilesResult {
        success,
        failed,
        total,
    }
}
