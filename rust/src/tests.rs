use super::*;
use goblin::elf::{header::*, sym};
use scroll::Pwrite;

fn fixture(name: &str) -> Vec<u8> {
    std::fs::read(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name),
    )
    .unwrap()
}

fn header_bytes(class: u8, endian: u8) -> Vec<u8> {
    let mut header = Header::new(goblin::container::Ctx::default());
    header.e_ident[..4].copy_from_slice(ELFMAG);
    header.e_ident[EI_CLASS] = class;
    header.e_ident[EI_DATA] = endian;
    header.e_ident[EI_VERSION] = EV_CURRENT;
    header.e_version = u32::from(EV_CURRENT);
    header.e_machine = EM_386;
    header.e_type = ET_EXEC;
    header.e_entry = 0x12345678;
    header.e_ehsize = if class == ELFCLASS32 { 52 } else { 64 };
    let mut data = vec![0; usize::from(header.e_ehsize)];
    data.pwrite(header, 0).unwrap();
    data
}

#[test]
fn all_classes_and_byte_orders() {
    for class in [ELFCLASS32, ELFCLASS64] {
        for endian in [ELFDATA2LSB, ELFDATA2MSB] {
            let data = header_bytes(class, endian);
            let quick = ElfParser::quickparseelf(data.clone()).unwrap();
            let full = parse(&data).unwrap().info;
            assert_eq!(quick.entrypoint, 0x12345678);
            assert_eq!(quick.entrypoint, full.entrypoint);
            assert_eq!(quick.machine, "386");
            assert_eq!(quick.class, class_to_str(class));
            assert_eq!(
                quick.endianness,
                if endian == ELFDATA2LSB {
                    "Little Endian"
                } else {
                    "Big Endian"
                }
            );
            assert_eq!(quick.stripped, None);
            assert_eq!(full.stripped, Some(true));
            assert!(ElfParser::validateelf(data).unwrap());
        }
    }
}

#[test]
fn invalid_headers_never_produce_default_metadata() {
    for class in [ELFCLASS32, ELFCLASS64] {
        let valid = header_bytes(class, ELFDATA2LSB);
        for length in 0..valid.len() {
            assert!(ElfParser::quickparseelf(valid[..length].to_vec()).is_err());
            assert!(ElfParser::validateelf(valid[..length].to_vec()).is_err());
        }
        for (offset, value) in [
            (0, 0),
            (EI_CLASS, 0),
            (EI_DATA, 0),
            (EI_VERSION, 0),
            (20, 0),
        ] {
            let mut invalid = valid.clone();
            invalid[offset] = value;
            assert!(ElfParser::quickparseelf(invalid.clone()).is_err());
            assert!(parse(&invalid).is_err());
        }
    }
}

#[test]
fn known_fixtures_have_exact_metadata() {
    for (name, machine, entry, stripped) in [
        ("simple_test", "X86_64", 0x23d0, true),
        ("simple_test2", "X86_64", 0xa4c30, false),
        ("go-away", "S390", 0x78ee0, true),
    ] {
        let data = fixture(name);
        let info = parse(&data).unwrap().info;
        let header = ElfParser::quickparseelf(data).unwrap();
        assert_eq!(info.machine, machine);
        assert_eq!(info.entrypoint, entry);
        assert_eq!(header.entrypoint, entry);
        assert_eq!(header.endianness, info.endianness);
        assert_eq!(info.stripped, Some(stripped));
    }
    assert_eq!(
        parse(&fixture("phdr.73prg.bin"))
            .unwrap()
            .programheaders
            .len(),
        73
    );
}

#[test]
fn os_abi_is_not_a_machine_number() {
    assert_eq!(metadata::osabi_name(ELFOSABI_GNU), "GNU");
    assert_eq!(metadata::osabi_name(ELFOSABI_TRU64), "TRU64");
    assert_eq!(metadata::osabi_name(254), "Unknown (254)");
}

#[test]
fn symbol_visibility_comes_from_other_not_type() {
    let mut data = fixture("simple_test2");
    let elf = Elf::parse(&data).unwrap();
    let table = elf
        .section_headers
        .iter()
        .find(|section| section.sh_type == SHT_SYMTAB)
        .unwrap();
    let offset = table.sh_offset as usize + table.sh_entsize as usize;
    // ELF64 symbol: st_info at +4, st_other at +5.
    data[offset + 4] = (sym::STB_GLOBAL << 4) | sym::STT_FUNC;
    data[offset + 5] = sym::STV_HIDDEN;
    let parsed = parse(&data).unwrap();
    assert_eq!(parsed.symbols.len(), 23328);
    assert_eq!(parsed.symbols[1].typestr, "FUNC");
    assert_eq!(parsed.symbols[1].vis, "HIDDEN");
}
