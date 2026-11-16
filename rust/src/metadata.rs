use crate::elfpreview::parser::types::Fileinfo;
use goblin::{
    elf::header::*,
    error::{Error, Result},
};
use scroll::{Endian, Pread};

pub(crate) fn parse_header(data: &[u8]) -> Result<Header> {
    let header: Header = data.pread(0)?;
    if header.e_ident[EI_VERSION] != EV_CURRENT || header.e_version != u32::from(EV_CURRENT) {
        return Err(Error::Malformed("Unsupported ELF version".into()));
    }
    Ok(header)
}

pub(crate) fn file_info(header: &Header, stripped: bool) -> Result<Fileinfo> {
    Ok(Fileinfo {
        machine: machine_to_str(header.e_machine).into(),
        entrypoint: header.e_entry,
        class: class_to_str(header.e_ident[EI_CLASS]).into(),
        endianness: match header.endianness()? {
            Endian::Little => "Little Endian",
            Endian::Big => "Big Endian",
        }
        .into(),
        osabi: osabi_name(header.e_ident[EI_OSABI]),
        filetype: et_to_str(header.e_type).into(),
        version: header.e_version,
        stripped,
    })
}

pub(crate) fn osabi_name(abi: u8) -> String {
    match abi {
        ELFOSABI_SYSV => "UNIX - System V",
        ELFOSABI_HPUX => "HP-UX",
        ELFOSABI_NETBSD => "NetBSD",
        ELFOSABI_GNU => "GNU",
        ELFOSABI_SOLARIS => "Solaris",
        ELFOSABI_AIX => "AIX",
        ELFOSABI_IRIX => "IRIX",
        ELFOSABI_FREEBSD => "FreeBSD",
        ELFOSABI_TRU64 => "TRU64",
        ELFOSABI_MODESTO => "Modesto",
        ELFOSABI_OPENBSD => "OpenBSD",
        ELFOSABI_ARM_AEABI => "ARM EABI",
        ELFOSABI_ARM => "ARM",
        ELFOSABI_STANDALONE => "Standalone",
        _ => return format!("Unknown ({abi})"),
    }
    .into()
}
