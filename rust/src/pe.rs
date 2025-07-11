use crate::bindings::bininspect::api::types as wit_types;
use goblin::pe::optional_header;
use goblin::pe::*;
use std::collections::BTreeMap;

fn get_optional<'a>(pe: &'a PE) -> Result<&'a optional_header::OptionalHeader, String> {
    pe.header
        .optional_header
        .as_ref()
        .ok_or_else(|| "Missing optional header".to_string())
}

pub fn parse_pe(data: &[u8]) -> Result<crate::model::PeDetails, String> {
    match PE::parse(data) {
        Ok(pe) => {
            let opt = get_optional(&pe)?;

            let info = crate::model::PeDetails {
                sections: build_section_info(&pe),
                imports: build_import_info(&pe),
                exports: build_export_info(&pe),
                subsystem: get_subsystem_str(opt.windows_fields.subsystem),
                dll_characteristics: get_dll_characteristics_str(
                    opt.windows_fields.dll_characteristics,
                ),
                image_base: opt.windows_fields.image_base,
            };

            Ok(info)
        }
        Err(e) => Err(format!("{:?}", e)),
    }
}

pub fn parse_pe_header(data: &[u8]) -> Result<crate::model::BasicInfo, String> {
    match goblin::Object::parse(data) {
        Ok(goblin::Object::PE(pe)) => crate::utils::build_basic_info_pe("PE", &pe),
        Ok(_) => Err("Not a PE binary".into()),
        Err(e) => Err(e.to_string()),
    }
}

fn build_section_info(pe: &PE) -> Vec<wit_types::PeSectionInfo> {
    pe.sections
        .iter()
        .map(|section| wit_types::PeSectionInfo {
            name: String::from_utf8_lossy(&section.name).to_string(),
            virtual_size: section.virtual_size,
            virtual_address: section.virtual_address,
            size_of_raw_data: section.size_of_raw_data,
            pointer_to_raw_data: section.pointer_to_raw_data,
            characteristics: format_section_characteristics(section.characteristics),
        })
        .collect()
}

fn build_import_info(pe: &PE) -> Vec<wit_types::PeImportInfo> {
    let mut map: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for import in &pe.imports {
        let dll = import.dll.to_string();
        let name = import.name.to_string();
        map.entry(dll).or_default().push(name);
    }

    map.into_iter()
        .map(|(dll_name, functions)| wit_types::PeImportInfo {
            dll_name,
            functions,
        })
        .collect()
}

fn build_export_info(pe: &PE) -> Vec<wit_types::PeExportInfo> {
    pe.exports
        .iter()
        .map(|export| wit_types::PeExportInfo {
            name: export.name.unwrap_or("").to_string(),
            ordinal: 0,
            rva: export.rva as u32,
        })
        .collect()
}

fn get_subsystem_str(subsystem: u16) -> String {
    match subsystem {
        0 => "Unknown".to_string(),
        1 => "Native".to_string(),
        2 => "Windows GUI".to_string(),
        3 => "Windows CUI".to_string(),
        5 => "OS/2 CUI".to_string(),
        7 => "POSIX CUI".to_string(),
        8 => "Native Win9x Driver".to_string(),
        9 => "Windows CE GUI".to_string(),
        10 => "EFI Application".to_string(),
        11 => "EFI Boot Service Driver".to_string(),
        12 => "EFI Runtime Driver".to_string(),
        13 => "EFI ROM".to_string(),
        14 => "XBOX".to_string(),
        16 => "Windows Boot Application".to_string(),
        _ => format!("Unknown ({})", subsystem),
    }
}

fn get_dll_characteristics_str(characteristics: u16) -> String {
    let mut flags = Vec::new();

    if characteristics & 0x0020 != 0 {
        flags.push("High Entropy VA");
    }
    if characteristics & 0x0040 != 0 {
        flags.push("Dynamic Base");
    }
    if characteristics & 0x0080 != 0 {
        flags.push("Force Integrity");
    }
    if characteristics & 0x0100 != 0 {
        flags.push("NX Compatible");
    }
    if characteristics & 0x0200 != 0 {
        flags.push("No Isolation");
    }
    if characteristics & 0x0400 != 0 {
        flags.push("No SEH");
    }
    if characteristics & 0x0800 != 0 {
        flags.push("No Bind");
    }
    if characteristics & 0x2000 != 0 {
        flags.push("WDM Driver");
    }
    if characteristics & 0x8000 != 0 {
        flags.push("Terminal Server Aware");
    }

    if flags.is_empty() {
        "None".to_string()
    } else {
        flags.join(" | ")
    }
}

fn format_section_characteristics(characteristics: u32) -> String {
    let mut flags = Vec::new();

    if characteristics & 0x00000020 != 0 {
        flags.push("CNT_CODE");
    }
    if characteristics & 0x00000040 != 0 {
        flags.push("CNT_INITIALIZED_DATA");
    }
    if characteristics & 0x00000080 != 0 {
        flags.push("CNT_UNINITIALIZED_DATA");
    }
    if characteristics & 0x02000000 != 0 {
        flags.push("MEM_DISCARDABLE");
    }
    if characteristics & 0x04000000 != 0 {
        flags.push("MEM_NOT_CACHED");
    }
    if characteristics & 0x08000000 != 0 {
        flags.push("MEM_NOT_PAGED");
    }
    if characteristics & 0x10000000 != 0 {
        flags.push("MEM_SHARED");
    }
    if characteristics & 0x20000000 != 0 {
        flags.push("MEM_EXECUTE");
    }
    if characteristics & 0x40000000 != 0 {
        flags.push("MEM_READ");
    }
    if characteristics & 0x80000000 != 0 {
        flags.push("MEM_WRITE");
    }

    if flags.is_empty() {
        "None".to_string()
    } else {
        flags.join(" | ")
    }
}
