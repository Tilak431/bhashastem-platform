'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardCheck,
  LayoutDashboard,
  Library,
  MessageCircle,
  Sparkles,
  Search,
  Rss,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Header } from '@/components/common/Header';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
  },
  {
    href: '/feed',
    icon: Rss,
    label: 'Feed',
  },
  {
    href: '/search',
    icon: Search,
    label: 'Search Users',
  },
  {
    href: '/library',
    icon: Library,
    label: 'Content Library',
  },
  {
    href: '/quizzes',
    icon: ClipboardCheck,
    label: 'Assessments',
  },
  {
    href: '/ask',
    icon: MessageCircle,
    label: 'Ask AI',
  },
  {
    href: '/recommendations',
    icon: Sparkles,
    label: 'Get Recommendations',
  },
];

function AppNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading) {
    // You can show a loading spinner here
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar
        variant="sidebar"
        collapsible="icon"
        className="border-sidebar-border"
      >
        <SidebarContent>
          <SidebarHeader className="p-4">
            <div
              className={cn(
                'flex items-center gap-2',
                'group-data-[collapsible=icon]:hidden'
              )}
            >
              <h2 className="font-headline text-2xl font-semibold text-sidebar-primary">
                BhashaSTEM
              </h2>
            </div>
          </SidebarHeader>

          <SidebarMenu>
            {navItems.map(item => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={{ children: item.label }}
                    as="a"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>{/* Footer content if any */}</SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AppNavigation>{children}</AppNavigation>
    </FirebaseClientProvider>
  );
}

    