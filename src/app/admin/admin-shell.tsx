"use client";

import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import type {
  ReactNode,
} from "react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";


type IconName =
  | "dashboard"
  | "growth"
  | "conversion"
  | "operations"
  | "monitor"
  | "shield"
  | "truck"
  | "leads"
  | "onboarding"
  | "mail"
  | "tasks"
  | "rocket"
  | "tools"
  | "linkedin"
  | "import"
  | "settings";


type NavItem = {
  href:
    string;

  label:
    string;

  group:
    | "Overview"
    | "Operations"
    | "Automation"
    | "Workspace";

  icon:
    IconName;

  status?:
    | "live"
    | "protected"
    | "new";
};


const NAV_ITEMS:
  NavItem[] = [
    {
      href:
        "/admin/dashboard",

      label:
        "Dashboard",

      group:
        "Overview",

      icon:
        "dashboard",
    },

    {
      href:
        "/admin/acquisition",

      label:
        "Acquisition",

      group:
        "Overview",

      icon:
        "growth",
    },

    {
      href:
        "/admin/conversions",

      label:
        "Conversions",

      group:
        "Overview",

      icon:
        "conversion",
    },

    {
      href:
        "/admin/carriers",

      label:
        "Carriers",

      group:
        "Operations",

      icon:
        "truck",
    },

    {
      href:
        "/admin/leads",

      label:
        "Leads",

      group:
        "Operations",

      icon:
        "leads",
    },

    {
      href:
        "/admin/replies",

      label:
        "Replies",

      group:
        "Operations",

      icon:
        "mail",
    },

    {
      href:
        "/admin/tasks",

      label:
        "Tasks",

      group:
        "Operations",

      icon:
        "tasks",
    },

    {
      href:
        "/admin/onboarding",

      label:
        "Onboarding",

      group:
        "Operations",

      icon:
        "onboarding",
    },

    {
      href:
        "/admin/operations",

      label:
        "Carrier Operations",

      group:
        "Operations",

      icon:
        "operations",

      status:
        "new",
    },
    {
      href:
        "/admin/loadboard",

      label:
        "Load Board",

      group:
        "Operations",

      icon:
        "operations",

      status:
        "new",
    },

    {
      href:
        "/admin/pilot",

      label:
        "Pilot Launch",

      group:
        "Automation",

      icon:
        "rocket",
    },

    {
      href:
        "/admin/linkedin",

      label:
        "LinkedIn Outreach",

      group:
        "Automation",

      icon:
        "linkedin",

      status:
        "new",
    },

    {
      href:
        "/admin/monitoring",

      label:
        "Monitoring",

      group:
        "Automation",

      icon:
        "monitor",

      status:
        "live",
    },

    {
      href:
        "/admin/monitoring/safety",

      label:
        "Safety Center",

      group:
        "Automation",

      icon:
        "shield",

      status:
        "protected",
    },

    {
      href:
        "/admin/tools",

      label:
        "Dispatcher Tools",

      group:
        "Workspace",

      icon:
        "tools",
    },

    {
      href:
        "/admin/import",

      label:
        "FMCSA Import",

      group:
        "Workspace",

      icon:
        "import",
    },

    {
      href:
        "/admin/settings",

      label:
        "Settings",

      group:
        "Workspace",

      icon:
        "settings",
    },
  ];


const GROUPS:
  NavItem["group"][] = [
    "Overview",
    "Operations",
    "Automation",
    "Workspace",
  ];


const ICON_PATHS:
  Record<
    IconName,
    string[]
  > = {
    dashboard: [
      "M3 3h7v7H3z",
      "M14 3h7v4h-7z",
      "M14 11h7v10h-7z",
      "M3 14h7v7H3z",
    ],

    growth: [
      "M4 19V9",
      "M9 19V5",
      "M14 19v-7",
      "M19 19V3",
    ],

    conversion: [
      "M4 5h16",
      "M7 10h10",
      "M10 15h4",
      "M12 15v6",
      "m9 18 3 3 3-3",
    ],

    operations: [
      "M3 7h11v9H3z",
      "M14 10h4l3 3v3h-7z",
      "M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
      "M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
      "M6 10h5",
      "M8.5 7.5v5",
    ],

    monitor: [
      "M3 12h4l2-5 4 10 2-5h6",
    ],

    shield: [
      "M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6z",
      "m9 12 2 2 4-4",
    ],

    truck: [
      "M3 6h11v10H3z",
      "M14 10h4l3 3v3h-7z",
      "M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
      "M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    ],

    leads: [
      "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
      "M2.5 21a6.5 6.5 0 0 1 13 0",
      "M17 8h5",
      "M19.5 5.5v5",
    ],

    onboarding: [
      "M6 3h9l3 3v15H6z",
      "M15 3v4h4",
      "m9 15 2 2 4-4",
    ],

    mail: [
      "M3 5h18v14H3z",
      "m3 7 6 5 6-5",
    ],

    tasks: [
      "M5 4h14v16H5z",
      "m8 9 2 2 4-4",
      "M8 8h4",
    ],

    rocket: [
      "M14 5c2.5-2.5 5.8-2.5 7-2-0.5 4-1.5 7-4 9l-4 1-5-5z",
      "M9 14 4 1 3-3",
      "M10 18 1 3 3-3",
    ],

    tools: [
      "M4 5h16v14H4z",
      "M8 9h8",
      "M8 13h3",
      "M15 13h1",
    ],

    linkedin: [
      "M5 9v10",
      "M5 5.5v.1",
      "M10 19V9",
      "M10 13c0-2 1.4-4 4-4 3 0 5 2 5 5v5",
    ],

    import: [
      "M12 3v12",
      "m7 10 5 5 5-5",
      "M4 19h16",
    ],

    settings: [
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
      "M12 2v3",
      "M12 19v3",
      "M4.9 4.9 7 7",
      "m17 17 2.1 2.1",
      "M2 12h3",
      "M19 12h3",
      "m4.9 19.1 2.1-2.1",
      "m17 7 2.1-2.1",
    ],
  };


function Icon({
  name,
  className,
}: {
  name:
    IconName;

  className?:
    string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={
        className
      }
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >

      {ICON_PATHS[
        name
      ].map(
        (
          path,
        ) => (
          <path
            d={
              path
            }
            key={
              path
            }
          />
        ),
      )}

    </svg>
  );
}


function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="11"
        cy="11"
        r="6"
      />

      <path d="m16 16 4 4" />
    </svg>
  );
}


function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}


function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}


function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open:
    boolean;

  onClose:
    () => void;

  onNavigate:
    (
      href:
        string,
    ) => void;
}) {
  const [
    query,
    setQuery,
  ] =
    useState(
      "",
    );


  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );


  useEffect(
    () => {
      if (
        !open
      ) {
        setQuery(
          "",
        );

        return;
      }


      const timer =
        window.setTimeout(
          () => {
            inputRef.current?.focus();
          },
          20,
        );


      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      open,
    ],
  );


  const results =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();


        if (
          !normalized
        ) {
          return NAV_ITEMS;
        }


        return NAV_ITEMS.filter(
          (
            item,
          ) =>
            `${item.label} ${item.group}`
              .toLowerCase()
              .includes(
                normalized,
              ),
        );
      },
      [
        query,
      ],
    );


  if (
    !open
  ) {
    return null;
  }


  return (
    <div
      className="sl-command-backdrop"
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >

      <div
        className="sl-command"
        role="dialog"
        aria-modal="true"
        aria-label="Navigate SlateLane CRM"
      >

        <div className="sl-command-search">

          <span className="sl-command-search-icon">
            <SearchIcon />
          </span>


          <input
            ref={
              inputRef
            }
            value={
              query
            }
            onChange={(
              event,
            ) =>
              setQuery(
                event.target
                  .value,
              )
            }
            placeholder="Search pages, tools and workflows..."
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                "Escape"
              ) {
                onClose();
              }


              if (
                event.key ===
                  "Enter" &&
                results[0]
              ) {
                onNavigate(
                  results[0]
                    .href,
                );
              }
            }}
          />

          <kbd>
            ESC
          </kbd>

        </div>


        <div className="sl-command-results">

          {results.length >
          0 ? (
            results.map(
              (
                item,
              ) => (
                <button
                  type="button"
                  className="sl-command-item"
                  key={
                    item.href
                  }
                  onClick={() =>
                    onNavigate(
                      item.href,
                    )
                  }
                >

                  <span className="sl-command-item-icon">
                    <Icon
                      name={
                        item.icon
                      }
                    />
                  </span>


                  <span>

                    <strong>
                      {
                        item.label
                      }
                    </strong>

                    <small>
                      {
                        item.group
                      }
                    </small>

                  </span>


                  <span className="sl-command-arrow">
                    ↵
                  </span>

                </button>
              ),
            )
          ) : (
            <div className="sl-command-empty">
              No CRM page matches “
              {query}
              ”.
            </div>
          )}

        </div>


        <div className="sl-command-footer">

          <span>
            ↑↓ Navigate
          </span>

          <span>
            Enter Open
          </span>

          <span>
            Esc Close
          </span>

        </div>

      </div>

    </div>
  );
}


export default function AdminShell({
  children,
}: {
  children:
    ReactNode;
}) {
  const pathname =
    usePathname();


  const router =
    useRouter();


  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(
      false,
    );


  const [
    commandOpen,
    setCommandOpen,
  ] =
    useState(
      false,
    );


  const [
    navigatingTo,
    setNavigatingTo,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const activeItem =
    useMemo(
      () => {
        const matches =
          NAV_ITEMS.filter(
            (
              item,
            ) =>
              pathname ===
                item.href ||
              pathname.startsWith(
                `${item.href}/`,
              ),
          );


        return matches.sort(
          (
            a,
            b,
          ) =>
            b.href.length -
            a.href.length,
        )[0];
      },
      [
        pathname,
      ],
    );


  useEffect(
    () => {
      setNavigatingTo(
        null,
      );

      setMobileOpen(
        false,
      );
    },
    [
      pathname,
    ],
  );


  useEffect(
    () => {
      function onKeyDown(
        event:
          KeyboardEvent,
      ) {
        if (
          (
            event.metaKey ||
            event.ctrlKey
          ) &&
          event.key.toLowerCase() ===
            "k"
        ) {
          event.preventDefault();

          setCommandOpen(
            (
              current,
            ) =>
              !current,
          );
        }


        if (
          event.key ===
          "Escape"
        ) {
          setCommandOpen(
            false,
          );

          setMobileOpen(
            false,
          );
        }
      }


      window.addEventListener(
        "keydown",
        onKeyDown,
      );


      return () =>
        window.removeEventListener(
          "keydown",
          onKeyDown,
        );
    },
    [],
  );


  function warmRoute(
    href:
      string,
  ) {
    router.prefetch(
      href,
    );
  }


  function startNavigation(
    href:
      string,
  ) {
    if (
      href ===
      pathname
    ) {
      return;
    }


    setNavigatingTo(
      href,
    );
  }


  function commandNavigate(
    href:
      string,
  ) {
    setCommandOpen(
      false,
    );

    setMobileOpen(
      false,
    );

    setNavigatingTo(
      href,
    );

    router.push(
      href,
    );
  }


  return (
    <div className="sl-admin">

      {navigatingTo ? (
        <div
          className="sl-route-progress"
          aria-hidden="true"
        >
          <span />
        </div>
      ) : null}


      <button
        type="button"
        className={`sl-mobile-overlay ${
          mobileOpen
            ? "is-visible"
            : ""
        }`}
        aria-label="Close navigation"
        onClick={() =>
          setMobileOpen(
            false,
          )
        }
      />


      <aside
        className={`sl-sidebar ${
          mobileOpen
            ? "is-open"
            : ""
        }`}
      >

        <div className="sl-sidebar-brand">

          <Link
            href="/admin/dashboard"
            className="sl-brand"
            onMouseEnter={() =>
              warmRoute(
                "/admin/dashboard",
              )
            }
            onFocus={() =>
              warmRoute(
                "/admin/dashboard",
              )
            }
            onClick={() =>
              startNavigation(
                "/admin/dashboard",
              )
            }
          >

            <span
              className="sl-brand-mark"
              aria-hidden="true"
            >
              <span />
              <span />
            </span>


            <span className="sl-brand-copy">

              <strong>
                SlateLane
              </strong>

              <small>
                Dispatch OS
              </small>

            </span>

          </Link>


          <button
            type="button"
            className="sl-sidebar-close"
            onClick={() =>
              setMobileOpen(
                false,
              )
            }
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>

        </div>


        <div className="sl-sidebar-scroll">

          {GROUPS.map(
            (
              group,
            ) => (
              <div
                className="sl-nav-group"
                key={
                  group
                }
              >

                <div className="sl-nav-label">
                  {group}
                </div>


                <div className="sl-nav-list">

                  {NAV_ITEMS
                    .filter(
                      (
                        item,
                      ) =>
                        item.group ===
                        group,
                    )
                    .map(
                      (
                        item,
                      ) => {
                        const active =
                          activeItem?.href ===
                          item.href;


                        return (
                          <Link
                            key={
                              item.href
                            }
                            href={
                              item.href
                            }
                            prefetch={
                              false
                            }
                            className={`sl-nav-item ${
                              active
                                ? "is-active"
                                : ""
                            }`}
                            aria-current={
                              active
                                ? "page"
                                : undefined
                            }
                            onMouseEnter={() =>
                              warmRoute(
                                item.href,
                              )
                            }
                            onFocus={() =>
                              warmRoute(
                                item.href,
                              )
                            }
                            onTouchStart={() =>
                              warmRoute(
                                item.href,
                              )
                            }
                            onClick={() =>
                              startNavigation(
                                item.href,
                              )
                            }
                          >

                            <span className="sl-nav-icon">
                              <Icon
                                name={
                                  item.icon
                                }
                              />
                            </span>


                            <span className="sl-nav-text">
                              {
                                item.label
                              }
                            </span>


                            {item.status ? (
                              <span
                                className={`sl-nav-status is-${item.status}`}
                              >
                                {item.status ===
                                "live"
                                  ? "Live"
                                  : item.status ===
                                      "protected"
                                    ? "Safe"
                                    : "New"}
                              </span>
                            ) : null}

                          </Link>
                        );
                      },
                    )}

                </div>

              </div>
            ),
          )}

        </div>


        <div className="sl-sidebar-footer">

          <div className="sl-environment-card">

            <span className="sl-live-dot" />

            <div>

              <strong>
                Production
              </strong>

              <small>
                Systems operational
              </small>

            </div>

            <span className="sl-env-pill">
              LIVE
            </span>

          </div>

        </div>

      </aside>


      <div className="sl-stage">

        <header className="sl-topbar">

          <div className="sl-topbar-left">

            <button
              type="button"
              className="sl-menu-button"
              onClick={() =>
                setMobileOpen(
                  true,
                )
              }
              aria-label="Open navigation"
            >
              <MenuIcon />
            </button>


            <div className="sl-breadcrumb">

              <span>
                SlateLane
              </span>

              <i>
                /
              </i>

              <strong>
                {activeItem?.label ??
                  "CRM"}
              </strong>

            </div>

          </div>


          <div className="sl-topbar-actions">

            <button
              type="button"
              className="sl-command-trigger"
              onClick={() =>
                setCommandOpen(
                  true,
                )
              }
            >

              <span className="sl-command-trigger-icon">
                <SearchIcon />
              </span>

              <span className="sl-command-trigger-label">
                Search CRM
              </span>

              <kbd>
                ⌘ K
              </kbd>

            </button>


            <Link
              href="/admin/replies?handling=open"
              prefetch={
                false
              }
              className="sl-top-action"
              onMouseEnter={() =>
                warmRoute(
                  "/admin/replies?handling=open",
                )
              }
              onFocus={() =>
                warmRoute(
                  "/admin/replies?handling=open",
                )
              }
              onClick={() =>
                startNavigation(
                  "/admin/replies?handling=open",
                )
              }
            >
              Open inbox
            </Link>


            <div
              className="sl-profile"
              title="SlateLane Admin"
            >
              SL
            </div>

          </div>

        </header>


        <main className="sl-content">

          <div className="sl-content-inner">
            {children}
          </div>

        </main>

      </div>


      <CommandPalette
        open={
          commandOpen
        }
        onClose={() =>
          setCommandOpen(
            false,
          )
        }
        onNavigate={
          commandNavigate
        }
      />

    </div>
  );
}