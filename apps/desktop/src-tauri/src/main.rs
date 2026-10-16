#![forbid(unsafe_code)]
fn main() {
    if overmind_desktop::run().is_err() {
        overmind_desktop::report_startup_failure();
        std::process::exit(1);
    }
}
