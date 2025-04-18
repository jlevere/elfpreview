wit_bindgen::generate!({
    path: "../wit/",
    world: "elfpreview",
});

use crate::exports::elfpreview::parser::elfparser::Guest;
use goblin::elf::*;
use scroll::{Endian, Pread};

struct ElfParser;

impl Guest for ElfParser {
    fn parseelf(data: Vec<u8>) -> Result<elfpreview::parser::types::Elfinfo, String> {
        match Elf::parse(&data) {
            Ok(elf) => {
                let info = elfpreview::parser::types::Elfinfo {
                    info: build_file_info(&elf),
                    sectionheaders: build_section_info(&elf),
                    programheaders: build_program_info(&elf),
                    symbols: build_sym_info(&elf),
                    dynlink: build_dynlink_info(&elf),
                };

                Ok(info)
            }
            Err(e) => Err(format!("{:?}", e)),
        }
    }

    fn validateelf(data: Vec<u8>) -> Result<bool, String> {
        // Basic size check
        if data.len() < std::mem::size_of::<header::header64::Header>() {
            return Err("File too small to be an ELF".to_string());
        }

        // Check magic number
        if data[0] != 0x7F || data[1] != 0x45 || data[2] != 0x4C || data[3] != 0x46 {
            return Err("Invalid ELF magic number".to_string());
        }

        Ok(true)
    }

    fn quickparseelf(data: Vec<u8>) -> Result<elfpreview::parser::types::Fileinfo, String> {
        quick_parse_elf_header(&data)
    }
}

export!(ElfParser);

fn quick_parse_elf_header(data: &[u8]) -> Result<elfpreview::parser::types::Fileinfo, String> {
    if data.len() < std::mem::size_of::<header::header64::Header>() {
        return Err("File too small to be an ELF".to_string());
    }

    if &data[0..4] != b"\x7FELF" {
        return Err("Invalid ELF magic number".to_string());
    }

    let class = header::class_to_str(data[header::EI_CLASS]).to_string();
    let endianness = match data[header::EI_CLASS] {
        1 => "Little Endian".to_string(),
        2 => "Big Endian".to_string(),
        _ => format!("Unknown ({})", data[header::EI_CLASS]),
    };
    let osabi = osabi_to_str(data[header::EI_OSABI] as i32).to_string();

    let machine = match data.pread_with::<u16>(18, Endian::Little) {
        Ok(machine_type) => header::machine_to_str(machine_type).to_string(),
        Err(_) => "Unknown".to_string(),
    };

    let file_type = match data.pread_with::<u16>(16, Endian::Little) {
        Ok(e_type) => header::et_to_str(e_type).to_string(),
        Err(_) => "Unknown".to_string(),
    };

    let entry_point = data.pread_with::<u64>(24, Endian::Little).unwrap_or(0);
    let version = data.pread_with::<u32>(20, Endian::Little).unwrap_or(0);

    // Note: For quickparseelf, we're not doing the deep scan to check if it's stripped
    // A proper check would require parsing the section headers
    let stripped = false;

    Ok(elfpreview::parser::types::Fileinfo {
        machine,
        entrypoint: entry_point,
        class,
        endianness,
        osabi,
        filetype: file_type,
        version,
        stripped,
    })
}

fn build_file_info(elf: &Elf) -> elfpreview::parser::types::Fileinfo {
    let is_stripped = elf
        .section_headers
        .iter()
        .find(|&shdr| {
            if let Some(name) = elf.shdr_strtab.get_at(shdr.sh_name) {
                // Check for debug sections or full symbol table
                name.starts_with(".debug") || name == ".symtab"
            } else {
                false
            }
        })
        .is_none();

    return elfpreview::parser::types::Fileinfo {
        machine: header::machine_to_str(elf.header.e_machine).to_string(),
        entrypoint: elf.header.e_entry,
        class: header::class_to_str(elf.header.e_ident[header::EI_CLASS]).to_string(),

        endianness: match elf.header.endianness() {
            Ok(f) => match f {
                Endian::Big => "Big Endian".to_string(),
                Endian::Little => "Little Endian".to_string(),
            },
            _ => format!("Unknown ({})", elf.header.e_ident[header::EI_DATA]),
        },
        osabi: osabi_to_str(elf.header.e_ident[header::EI_OSABI] as i32).to_string(),
        filetype: header::et_to_str(elf.header.e_type).to_string(),
        version: elf.header.e_version,
        stripped: is_stripped,
    };
}

fn build_dynlink_info(elf: &Elf) -> elfpreview::parser::types::Dynlinkinfo {
    let is_dynamic = elf.is_lib
        || !elf.dynamic.is_none()
        || !elf.libraries.is_empty()
        || elf.interpreter.is_some()
        || !elf.rpaths.is_empty()
        || !elf.runpaths.is_empty();

    let interpreter = elf.interpreter.map(String::from);
    let needed_libs = elf.libraries.iter().map(|lib| lib.to_string()).collect();

    let soname = elf.soname.map(String::from);

    let rpath = if elf.rpaths.is_empty() {
        None
    } else {
        Some(elf.rpaths.iter().map(|s| s.to_string()).collect())
    };

    let runpath = if elf.runpaths.is_empty() {
        None
    } else {
        Some(elf.runpaths.iter().map(|s| s.to_string()).collect())
    };

    elfpreview::parser::types::Dynlinkinfo {
        is_dynamic,
        interpreter,
        needed_libs,
        soname,
        rpath,
        runpath,
    }
}

fn build_section_info(elf: &Elf) -> Vec<elfpreview::parser::types::Sectioninfo> {
    elf.section_headers
        .iter()
        .enumerate()
        .map(|(_i, header)| {
            let name = elf
                .shdr_strtab
                .get_at(header.sh_name)
                .unwrap_or("")
                .to_string();
            let typename = section_header::sht_to_str(header.sh_type).to_string();

            elfpreview::parser::types::Sectioninfo {
                name,
                size: header.sh_size,
                address: header.sh_addr,
                typename,
            }
        })
        .collect()
}

fn build_program_info(elf: &Elf) -> Vec<elfpreview::parser::types::Programinfo> {
    return elf
        .program_headers
        .iter()
        .map(|header| {
            let typename = program_header::pt_to_str(header.p_type).to_string();

            let flagstring = format!(
                "{}{}{}",
                if header.p_flags & 4 != 0 { "R" } else { "" },
                if header.p_flags & 2 != 0 { "W" } else { "" },
                if header.p_flags & 1 != 0 { "X" } else { "" },
            );

            elfpreview::parser::types::Programinfo {
                typename,
                flagstring,
                vaddr: header.p_vaddr,
                paddr: header.p_paddr,
                filesz: header.p_filesz,
                memsz: header.p_memsz,
            }
        })
        .collect();
}

fn build_sym_info(elf: &Elf) -> Vec<elfpreview::parser::types::Symbolinfo> {
    return elf
        .syms
        .iter()
        .map(|sym| {
            let name = elf.strtab.get_at(sym.st_name).unwrap_or("").to_string();
            elfpreview::parser::types::Symbolinfo {
                name,
                typestr: goblin::elf::sym::type_to_str(sym.st_type()).to_string(),
                bind: goblin::elf::sym::bind_to_str(sym.st_bind()).to_string(),
                vis: goblin::elf::sym::visibility_to_str(sym.st_type()).to_string(),
                value: sym.st_value,
                size: sym.st_size,
            }
        })
        .collect();
}

fn osabi_to_str(osabi: i32) -> &'static str {
    match osabi {
        0 => "UNIX - System V",
        1 => "AT&T WE 32100",
        2 => "SPARC",
        3 => "x86",
        4 => "Motorola 68k",
        5 => "Motorola 88k",
        6 => "Intel MCU",
        7 => "Intel 80860",
        8 => "MIPS",
        9 => "IBM System/370",
        10 => "MIPS RS3000",
        11 => "RS6000",
        15 => "HP PA-RISC",
        16 => "nCUBE",
        17 => "Fujitsu VPP500",
        18 => "SPARC32PLUS",
        19 => "Intel 80960",
        20 => "PowerPC",
        21 => "PowerPC 64-bit",
        22 => "S390",
        23 => "IBM SPU/SPC",
        24 => "cisco SVIP",
        25 => "cisco 7200",
        36 => "NEC V800",
        37 => "Fujitsu FR20",
        38 => "TRW RH-32",
        39 => "Motorola RCE",
        40 => "ARM",
        41 => "Digital Alpha",
        42 => "SuperH",
        43 => "SPARCv9",
        44 => "Siemens TriCore embedded processor",
        45 => "Argonaut RISC Core",
        46 => "Hitachi H8/300",
        47 => "Hitachi H8/300H",
        48 => "Hitachi H8S",
        49 => "Hitachi H8/500",
        50 => "IA-64",
        51 => "Stanford MIPS-X",
        52 => "Motorola ColdFire",
        53 => "Motorola M68HC12",
        54 => "Fujitsu MMA Multimedia Accelerator",
        55 => "Siemens PCP",
        56 => "Sony nCPU embedded RISC processor",
        57 => "Denso NDR1 microprocessor",
        58 => "Motorola StarCore",
        59 => "Toyota ME16",
        60 => "STMicroelectronics ST100",
        61 => "Advanced Logic TinyJ embedded processor",
        62 => "AMD X86-64",
        63 => "Sony DSP processor",
        64 => "PDP-10",
        65 => "PDP-11",
        66 => "Siemens FX66",
        67 => "STMicroelectronics ST9+",
        68 => "STMicroelectronics ST7",
        69 => "Motorola MC68HC16",
        70 => "Motorola MC68HC11",
        71 => "Motorola MC68HC08",
        72 => "Motorola MC68HC05",
        73 => "Silicon Graphics SVx",
        74 => "STMicroelectonrics ST19",
        75 => "Digital VAX",
        76 => "Axis Communications 32-bit CPU",
        77 => "Infineon Technologies 32-bit CPU",
        78 => "Element 14 64-bit DSP",
        79 => "LSI Logic 16-bit DSP",
        80 => "MMIX",
        81 => "Harvard machine-independent",
        82 => "SiTera Prism",
        83 => "Atmel AVR 8-bit",
        84 => "Fujitsu FR30",
        85 => "Mitsubishi D10V",
        86 => "Mitsubishi D30V",
        87 => "NEC v850",
        88 => "Renesas M32R",
        89 => "Matsushita MN10300",
        90 => "Matsushita MN10200",
        91 => "picoJava",
        92 => "OpenRISC",
        93 => "Synopsys ARCompact ARC700 cores",
        94 => "Tensilica Xtensa",
        95 => "Alphamosaic VideoCore",
        96 => "Thompson Multimedia",
        97 => "NatSemi 32k",
        98 => "Tenor Network TPC",
        99 => "Trebia SNP 1000",
        100 => "STMicroelectronics ST200",
        101 => "Ubicom IP2022",
        102 => "MAX Processor",
        103 => "NatSemi CompactRISC",
        104 => "Fujitsu F2MC16",
        105 => "TI msp430",
        106 => "Analog Devices Blackfin",
        107 => "S1C33 Family of Seiko Epson",
        108 => "Sharp embedded",
        109 => "Arca RISC",
        110 => "PKU-Unity Ltd.",
        111 => "eXcess: 16/32/64-bit",
        112 => "Icera Deep Execution Processor",
        113 => "Altera Nios II",
        114 => "NatSemi CRX",
        115 => "Motorola XGATE",
        116 => "Infineon C16x/XC16x",
        117 => "Renesas M16C series",
        118 => "Microchip dsPIC30F",
        119 => "Freescale RISC core",
        120 => "Renesas M32C series",
        131 => "Altium TSK3000 core",
        132 => "Freescale RS08",
        134 => "Cyan Technology eCOG2",
        135 => "Sunplus S+core7 RISC",
        136 => "New Japan Radio (NJR) 24-bit DSP",
        137 => "Broadcom VideoCore III processor",
        138 => "LatticeMico32",
        139 => "Seiko Epson C17 family",
        140 => "TMS320C6000",
        141 => "TMS320C2000",
        142 => "TMS320C55x",
        144 => "TI Programmable Realtime Unit",
        160 => "STMicroelectronics 64bit VLIW DSP",
        161 => "Cypress M8C",
        162 => "Renesas R32C series",
        163 => "NXP TriMedia family",
        164 => "Qualcomm DSP6",
        165 => "Intel 8051 and variants",
        166 => "STMicroelectronics STxP7x family",
        167 => "Andes embedded RISC",
        168 => "Cyan eCOG1X family",
        169 => "Dallas MAXQ30",
        170 => "New Japan Radio (NJR) 16-bit DSP",
        171 => "M2000 Reconfigurable RISC",
        172 => "Cray NV2 vector architecture",
        173 => "Renesas RX family",
        174 => "META",
        175 => "MCST Elbrus e2k",
        176 => "Cyan Technology eCOG16 family",
        177 => "NatSemi CompactRISC",
        178 => "Freescale Extended Time Processing Unit",
        179 => "Infineon SLE9X",
        180 => "Intel L1OM",
        181 => "Intel K1OM",
        183 => "ARM 64-bit",
        185 => "Atmel 32-bit family",
        186 => "STMicroeletronics STM8 8-bit",
        187 => "Tilera TILE64",
        188 => "Tilera TILEPro",
        189 => "Xilinx MicroBlaze 32-bit RISC",
        190 => "NVIDIA CUDA architecture",
        191 => "Tilera TILE-Gx",
        195 => "Synopsys ARCv2/HS3x/HS4x cores",
        197 => "Renesas RL78 family",
        199 => "Renesas 78K0R",
        200 => "Freescale 56800EX",
        201 => "Beyond BA1",
        202 => "Beyond BA2",
        203 => "XMOS xCORE",
        204 => "Microchip 8-bit PIC(r)",
        210 => "KM211 KM32",
        211 => "KM211 KMX32",
        212 => "KM211 KMX16",
        213 => "KM211 KMX8",
        214 => "KM211 KVARC",
        215 => "Paneve CDP",
        216 => "Cognitive Smart Memory",
        217 => "iCelero CoolEngine",
        218 => "Nanoradio Optimized RISC",
        219 => "CSR Kalimba architecture family",
        220 => "Zilog Z80",
        221 => "Controls and Data Services VISIUMcore processor",
        222 => "FTDI Chip FT32 high performance 32-bit RISC architecture",
        223 => "Moxie processor family",
        224 => "AMD GPU architecture",
        243 => "RISC-V",
        244 => "Lanai 32-bit processor",
        245 => "CEVA Processor Architecture Family",
        246 => "CEVA X2 Processor Family",
        247 => "Berkeley Packet Filter",
        248 => "Graphcore Intelligent Processing Unit",
        249 => "Imagination Technologies",
        250 => "Netronome Flow Processor",
        251 => "NEC Vector Engine",
        252 => "C-SKY processor family",
        253 => "Synopsys ARCv3 64-bit ISA/HS6x cores",
        254 => "MOS Technology MCS 6502 processor",
        255 => "Synopsys ARCv3 32-bit",
        256 => "Kalray VLIW core of the MPPA family",
        257 => "WDC 65C816",
        258 => "LoongArch",
        259 => "ChipON KungFu32",
        _ => "Unknown OSABI",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    // Helper function to load test ELF files
    fn load_test_elf(filename: &str) -> Vec<u8> {
        let test_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
        let filepath = test_dir.join(filename);
        fs::read(filepath).expect("Failed to read test ELF file")
    }

    #[test]
    fn test_quick_parse_simple_elf() {
        let elf_data = load_test_elf("go-away");
        let result = ElfParser::quickparseelf(elf_data);

        assert!(
            result.is_ok(),
            "Failed to quick parse ELF: {:?}",
            result.err()
        );

        let file_info = result.unwrap();

        assert!(
            !file_info.machine.is_empty(),
            "Machine type should not be empty"
        );
        assert!(file_info.entrypoint != 0, "Entry point should be non-zero");
        assert!(!file_info.class.is_empty(), "ELF class should not be empty");
        assert!(
            !file_info.endianness.is_empty(),
            "Endianness should not be empty"
        );
        assert!(!file_info.osabi.is_empty(), "OS ABI should not be empty");
        assert!(
            !file_info.filetype.is_empty(),
            "File type should not be empty"
        );
    }

    #[test]
    fn test_validate_elf_invalid() {
        // Test invalid magic number
        let text_data = load_test_elf("../../src/lib.rs");
        assert!(ElfParser::validateelf(text_data).is_err());

        // Test too short file
        let too_short = vec![0x7F, 0x45, 0x4C];
        assert!(ElfParser::validateelf(too_short).is_err());
    }

    #[test]
    fn test_parse_simple_elf() {
        let elf_data = load_test_elf("simple_test2");

        let result = ElfParser::parseelf(elf_data);
        assert!(result.is_ok(), "Failed to parse ELF: {:?}", result.err());

        let elf_info = result.unwrap();

        assert!(
            elf_info.sectionheaders.len() > 0,
            "Should have section headers"
        );
        assert!(
            elf_info.programheaders.len() > 0,
            "Should have program headers"
        );
        assert!(elf_info.symbols.len() > 0, "Should have symbols");
    }

    #[test]
    fn test_osabi_to_str() {
        assert!(
            osabi_to_str(10) == "MIPS RS3000",
            "should have been MIPS RS3000"
        );
    }

    #[test]
    fn test_simple_file_info_extraction() {
        let elf_data = load_test_elf("simple_test");

        let result = ElfParser::parseelf(elf_data);
        assert!(result.is_ok());

        let elf_info = result.unwrap();

        // Check basic file info properties
        assert!(elf_info.info.osabi == "UNIX - System V");
        assert!(elf_info.info.entrypoint == 0x23d0);
    }

    #[test]
    fn test_s390_file_info_extraction() {
        let elf_data = load_test_elf("go-away");

        let result = ElfParser::parseelf(elf_data);
        assert!(result.is_ok());

        let elf_info = result.unwrap();

        // Check basic file info properties
        assert!(elf_info.info.machine == "S390");
        assert!(elf_info.info.entrypoint == 0x78ee0);
    }

    #[test]
    fn test_bigphdr_file_info_extraction() {
        let elf_data = load_test_elf("phdr.73prg.bin");

        let result = ElfParser::parseelf(elf_data);
        assert!(result.is_ok());

        let elf_info = result.unwrap();

        // Check basic file info properties
        assert!(elf_info.programheaders.len() == 73);
    }
}
