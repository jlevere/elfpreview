use crate::model;

pub fn parse_mach_details(data: &[u8]) -> Result<model::MachDetails, String> {
    match goblin::Object::parse(data) {
        Ok(goblin::Object::Mach(_mach)) => {
            let details = model::MachDetails {
                segments: Vec::new(),
                dylibs: Vec::new(),
            };
            Ok(details)
        }
        Ok(_) => Err("Not a Mach-O binary".into()),
        Err(e) => Err(e.to_string()),
    }
}
