use crate::limits::Budget;
use std::fmt::{self, Write};

// Names are untrusted: bound both demangler input and output, including expansion
// through C++ substitutions. Optional display names share the report's text budget.
const MAX_NAME_BYTES: usize = 16 * 1024;

struct BoundedName {
    text: String,
    remaining: usize,
}
impl Write for BoundedName {
    fn write_str(&mut self, text: &str) -> fmt::Result {
        self.remaining = self.remaining.checked_sub(text.len()).ok_or(fmt::Error)?;
        self.text.push_str(text);
        Ok(())
    }
}

pub(crate) fn name(original: &str, budget: &mut Budget) -> Option<String> {
    if original.len() > MAX_NAME_BYTES || !original.starts_with('_') {
        return None;
    }
    let limit = budget.remaining_text().min(MAX_NAME_BYTES);
    if limit == 0 {
        return None;
    }
    let mut output = BoundedName {
        text: String::new(),
        remaining: limit,
    };
    if let Ok(symbol) = rustc_demangle::try_demangle(original) {
        write!(output, "{symbol:#}").ok()?;
    } else {
        let symbol = cpp_demangle::Symbol::new_with_options(
            original.as_bytes(),
            &cpp_demangle::ParseOptions::default().recursion_limit(64),
        )
        .ok()?;
        symbol
            .structured_demangle(
                &mut output,
                &cpp_demangle::DemangleOptions::default().recursion_limit(64),
            )
            .ok()?;
    }
    if output.text == original {
        return None;
    }
    budget
        .optional_text(output.text.len())
        .then_some(output.text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use goblin::elf::Elf;

    fn budget() -> Budget {
        crate::limits::check_report(
            &Elf::parse(&crate::tests::header_bytes(
                goblin::elf::header::ELFCLASS64,
                goblin::elf::header::ELFDATA2LSB,
            ))
            .unwrap(),
        )
        .unwrap()
    }

    #[test]
    fn rust_and_cpp_names_preserve_plain_and_unknown_symbols() {
        let mut budget = budget();
        assert_eq!(
            name("_ZN4test4main17h0123456789abcdefE", &mut budget).as_deref(),
            Some("test::main")
        );
        assert_eq!(name("_Z3fooi", &mut budget).as_deref(), Some("foo(int)"));
        assert_eq!(
            name("_RNvC9backtrace3foo", &mut budget).as_deref(),
            Some("backtrace::foo")
        );
        assert_eq!(name("free", &mut budget), None);
        assert_eq!(name("_Zbroken", &mut budget), None);
    }

    #[test]
    fn output_is_bounded_before_allocating_a_large_demangled_name() {
        let mut output = BoundedName {
            text: String::new(),
            remaining: 4,
        };
        assert!(output.write_str("12345").is_err());
        assert!(output.text.is_empty());
        let mut budget = budget();
        assert!(name(&format!("_Z{}", "x".repeat(MAX_NAME_BYTES)), &mut budget).is_none());
        budget.optional_text(budget.remaining_text() - 2);
        assert!(name("_Z3fooi", &mut budget).is_none());
        assert_eq!(budget.remaining_text(), 2);
    }
    #[test]
    fn repeated_cpp_substitutions_cannot_expand_past_the_name_limit() {
        let original = format!("_Z1f1000{}", "a".repeat(1000));
        let mut budget = budget();
        assert!(name(&original, &mut budget).is_some());
        let before = budget.remaining_text();
        assert!(name(&format!("{original}{}", "S_".repeat(30)), &mut budget).is_none());
        assert_eq!(budget.remaining_text(), before);
    }
}
