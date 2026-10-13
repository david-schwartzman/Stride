import { AuthPanel } from "@/features/auth/AuthPanel";

// Split layout for /login and /signup: brand panel left (hidden below bp-md),
// form column right. Root layout already provides <main id="main">.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto box-border flex w-full max-w-[1280px] flex-wrap items-stretch gap-14 px-4 pt-12 pb-18 md:px-8">
      <AuthPanel />
      <div className="mx-auto flex max-w-[480px] min-w-0 flex-[1_1_380px] flex-col justify-center gap-6">
        {children}
      </div>
    </div>
  );
}
