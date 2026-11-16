use super::*;
use goblin::elf::{header::*, section_header, sym};
use scroll::{Pread, Pwrite};

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
            let full = parse(&data).unwrap().info;
            assert_eq!(full.entrypoint, 0x12345678);
            assert_eq!(full.machine, "386");
            assert_eq!(full.class, class_to_str(class));
            assert_eq!(
                full.endianness,
                if endian == ELFDATA2LSB {
                    "Little Endian"
                } else {
                    "Big Endian"
                }
            );
            assert!(full.stripped);
        }
    }
}

#[test]
fn invalid_headers_never_produce_default_metadata() {
    for class in [ELFCLASS32, ELFCLASS64] {
        let valid = header_bytes(class, ELFDATA2LSB);
        for length in 0..valid.len() {
            assert!(parse(&valid[..length]).is_err());
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
        assert_eq!(info.machine, machine);
        assert_eq!(info.entrypoint, entry);
        assert_eq!(info.stripped, stripped);
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

#[test]
fn repeated_long_names_cannot_expand_a_small_file_into_a_huge_report() {
    let mut data = fixture("simple_test2");
    let elf = Elf::parse(&data).unwrap();
    let symbol = elf
        .syms
        .iter()
        .max_by_key(|symbol| elf.strtab.get_at(symbol.st_name).unwrap_or("").len())
        .unwrap();
    let name = u32::try_from(symbol.st_name).unwrap();
    assert!(elf.strtab.get_at(symbol.st_name).unwrap().len() * elf.syms.len() > 32 * 1024 * 1024);
    let table = elf
        .section_headers
        .iter()
        .find(|section| section.sh_type == SHT_SYMTAB)
        .unwrap();
    let count = elf.syms.len();
    let offset = table.sh_offset as usize;
    let stride = table.sh_entsize as usize;
    for index in 0..count {
        data.pwrite_with(name, offset + index * stride, scroll::LE)
            .unwrap();
    }
    assert!(
        parse(&data)
            .unwrap_err()
            .to_string()
            .contains("32 MiB text limit")
    );
}

#[test]
fn report_record_count_is_bounded_even_when_names_are_empty() {
    let data = header_bytes(ELFCLASS64, ELFDATA2LSB);
    let mut elf = Elf::parse(&data).unwrap();
    elf.program_headers.resize(
        250_001,
        goblin::elf::program_header::ProgramHeader::default(),
    );
    assert!(
        limits::check_report(&elf)
            .unwrap_err()
            .to_string()
            .contains("record limit")
    );
}

fn relocatable(class: u8, endian: u8, rela: bool) -> Vec<u8> {
    relocatable_with_names(class, endian, rela, b"\0external_symbol\0", 1)
}

fn relocatable_with_names(
    class: u8,
    endian: u8,
    rela: bool,
    symbol_names: &[u8],
    count: usize,
) -> Vec<u8> {
    use goblin::{
        container::{Container, Ctx},
        elf::{reloc::Reloc, section_header::SectionHeader, sym::Sym},
    };
    let container = if class == ELFCLASS64 {
        Container::Big
    } else {
        Container::Little
    };
    let byte_order = if endian == ELFDATA2LSB {
        scroll::LE
    } else {
        scroll::BE
    };
    let ctx = Ctx::new(container, byte_order);
    let mut data = header_bytes(class, endian);
    let mut header: Header = data.pread(0).unwrap();
    header.e_type = ET_REL;
    header.e_entry = 0;
    header.e_machine = if class == ELFCLASS64 {
        EM_X86_64
    } else {
        EM_386
    };
    let names = b"\0.text\0.strtab\0.symtab\0.reloc.text\0.shstrtab\0";
    let mut symbols = vec![0; 2 * Sym::size(container)];
    symbols
        .pwrite_with(
            Sym {
                st_name: 1,
                st_info: (sym::STB_GLOBAL << 4) | sym::STT_OBJECT,
                ..Default::default()
            },
            Sym::size(container),
            ctx,
        )
        .unwrap();
    let mut relocations = vec![0; count * Reloc::size(rela, ctx)];
    for index in 0..count {
        relocations
            .pwrite_with(
                Reloc {
                    r_offset: 0x10,
                    r_sym: 1,
                    r_type: 1,
                    r_addend: rela.then_some(-7),
                },
                index * Reloc::size(rela, ctx),
                (rela, ctx),
            )
            .unwrap();
    }
    let payloads: [&[u8]; 5] = [&[0; 32], symbol_names, &symbols, &relocations, names];
    let mut sections = vec![SectionHeader::default()];
    for (index, payload) in payloads.iter().enumerate() {
        let mut section = SectionHeader {
            sh_offset: data.len() as u64,
            sh_size: payload.len() as u64,
            sh_addralign: 1,
            ..Default::default()
        };
        match index {
            0 => {
                section.sh_name = 1;
                section.sh_type = section_header::SHT_PROGBITS;
                section.sh_flags = 6;
                section.sh_addralign = 16;
            }
            1 => {
                section.sh_name = 7;
                section.sh_type = section_header::SHT_STRTAB;
            }
            2 => {
                section.sh_name = 15;
                section.sh_type = SHT_SYMTAB;
                section.sh_link = 2;
                section.sh_entsize = Sym::size(container) as u64;
            }
            3 => {
                section.sh_name = 23;
                section.sh_type = if rela {
                    section_header::SHT_RELA
                } else {
                    section_header::SHT_REL
                };
                section.sh_link = 3;
                section.sh_info = 1;
                section.sh_entsize = Reloc::size(rela, ctx) as u64;
            }
            _ => {
                section.sh_name = 35;
                section.sh_type = section_header::SHT_STRTAB;
            }
        }
        sections.push(section);
        data.extend_from_slice(payload);
    }
    header.e_shoff = data.len() as u64;
    header.e_shnum = sections.len() as u16;
    header.e_shentsize = if class == ELFCLASS64 { 64 } else { 40 };
    header.e_shstrndx = 5;
    data.resize(
        data.len() + sections.len() * usize::from(header.e_shentsize),
        0,
    );
    for (index, section) in sections.iter().enumerate() {
        data.pwrite_with(
            section.clone(),
            header.e_shoff as usize + index * usize::from(header.e_shentsize),
            ctx,
        )
        .unwrap();
    }
    data.pwrite(header, 0).unwrap();
    data
}

#[test]
fn relocation_semantics_work_for_all_classes_byte_orders_and_addend_forms() {
    for class in [ELFCLASS32, ELFCLASS64] {
        for endian in [ELFDATA2LSB, ELFDATA2MSB] {
            for rela in [false, true] {
                let result = parse(&relocatable(class, endian, rela)).unwrap();
                assert_eq!(result.info.filetype, "REL");
                assert_eq!(result.sectionheaders[1].flags, 6);
                assert_eq!(result.sectionheaders[1].alignment, 16);
                assert_eq!(result.symbols[1].index, 1);
                assert_eq!(result.symbols[1].section_index, 0);
                assert_eq!(result.relocations.len(), 1);
                let entry = &result.relocations[0];
                assert_eq!(entry.offset, 0x10);
                assert_eq!(entry.target_section.as_deref(), Some(".text"));
                assert_eq!(entry.symbol_name.as_deref(), Some("external_symbol"));
                assert_eq!(entry.symbol_index, 1);
                assert_eq!(entry.addend, rela.then_some(-7));
                assert_eq!(entry.type_id, 1);
            }
        }
    }
}

#[test]
fn dynamic_symbols_and_relocations_survive_missing_section_headers() {
    let mut data = fixture("simple_test");
    let full = parse(&data).unwrap();
    assert!(!full.dynamic_symbols.is_empty());
    assert_eq!(full.relocations.len(), 66);
    let free = full
        .relocations
        .iter()
        .find(|entry| entry.symbol_name.as_deref() == Some("free"))
        .unwrap();
    assert_eq!(free.offset, 0x9000);
    assert_eq!(free.type_name, "R_X86_64_JUMP_SLOT");
    assert_eq!(free.addend, Some(0));
    // ELF64 e_shoff, e_shnum, and e_shstrndx: leave the PT_DYNAMIC image intact.
    data[40..48].fill(0);
    data[60..64].fill(0);
    let bare = parse(&data).unwrap();
    assert!(bare.sectionheaders.is_empty());
    assert_eq!(bare.dynamic_symbols.len(), full.dynamic_symbols.len());
    assert_eq!(
        bare.relocations.len(),
        full.relocations.len(),
        "dynamic and section views must not duplicate entries"
    );
    for (a, b) in bare.relocations.iter().zip(&full.relocations) {
        assert_eq!(a.offset, b.offset);
        assert_eq!(a.symbol_name, b.symbol_name);
        assert_eq!(a.addend, b.addend);
    }
}

#[test]
fn malformed_relocation_symbol_links_are_reported() {
    let mut data = relocatable(ELFCLASS64, ELFDATA2LSB, true);
    let elf = Elf::parse(&data).unwrap();
    let link = elf.header.e_shoff as usize + 4 * 64 + 40;
    data.pwrite_with(999u32, link, scroll::LE).unwrap();
    assert!(parse(&data).unwrap_err().to_string().contains("sh_link"));
}

#[test]
fn relocation_symbol_names_share_the_report_text_budget() {
    let mut names = vec![b'x'; 1024 * 1024 + 2];
    names[0] = 0;
    *names.last_mut().unwrap() = 0;
    let data = relocatable_with_names(ELFCLASS64, ELFDATA2LSB, true, &names, 40);
    assert!(data.len() < 2 * 1024 * 1024);
    assert!(
        parse(&data)
            .unwrap_err()
            .to_string()
            .contains("32 MiB text limit")
    );
}
