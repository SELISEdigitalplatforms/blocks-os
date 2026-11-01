import { Button } from "@/components/ui-kits/button/button";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { BookOpenText } from "lucide-react";
// import { BookOpenText, Component } from "lucide-react";
import { Link } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
export const BlockInfo = () => {
  const { t } = useT("os.idp.auth");
  return (
    <div className="mt-[24px] w-full p-4 shadow-none md:p-0 lg:mt-0 lg:max-w-md">
      <div className="mb-[36px] flex items-center gap-4">
        <Link to="https://docs.seliseblocks.com/" target="_blank" className="w-full">
          <Button variant="outline" className="w-full">
            <BookOpenText className="mr-3 h-4 w-4" />
            {t("BLOCKS_INFO.SEE_DOCS")}
          </Button>
        </Link>
      </div>
      <div className="mb-[36px] flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("BLOCKS_INFO.FRONTEND")}</h2>
        <div className="flex items-center gap-4">
          <div className="flex w-[50%] flex-col gap-2">
            <Button variant="outline" className="w-full">
              <img src="/assets/images/react-icon.png" width={20} height={20} alt={t("BLOCKS_INFO.LOGO_ALT", { name: "React" })} />
            </Button>
            <div className="flex items-center gap-2 text-blue-700 md:justify-between">
              <Link
                to="https://www.npmjs.com/package/@seliseblocks/cli-os"
                className="text-primary"
                target="_blank"
              >
                Npm
              </Link>
              <span className="h-4 w-px bg-gray-300"></span>
              <Link
                to="https://github.com/SELISEdigitalplatforms/l3-react-blocks-construct"
                className="text-primary"
                target="_blank"
              >
                GitHub
              </Link>
              <span className="h-4 w-px bg-gray-300"></span>
              <Link
                to={getRuntimeEnv("BLOCKS_CONSTRUCT_URL") || "https://construct.seliseblocks.com"}
                className="text-primary"
                target="_blank"
              >
                {t("BLOCKS_INFO.DEMO")}
              </Link>
            </div>
          </div>
          <div className="flex w-[50%] flex-col gap-2">
            <Button variant="outline" className="w-full" disabled>
              <img
                src="/assets/images/angular-icon.png"
                width={20}
                height={20}
                alt={t("BLOCKS_INFO.LOGO_ALT", { name: "Angular" })}
              />
            </Button>
            <p className="text-medium-emphasis">{t("BLOCKS_INFO.COMING_SOON")}</p>
          </div>
        </div>
      </div>
      <div className="mb-[36px] flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("BLOCKS_INFO.BACKEND")}</h2>
        <div className="flex items-center gap-4">
          <div className="flex w-[50%] flex-col gap-2">
            <Button variant="outline" className="w-full">
              <img src="/assets/images/dotnet-icon.png" width={20} height={20} alt={t("BLOCKS_INFO.LOGO_ALT", { name: ".NET" })} />
            </Button>
            <div className="flex items-center gap-1 text-blue-700 md:justify-between">
              <Link
                to="https://www.nuget.org/profiles/SELISE"
                className="text-primary"
                target="_blank"
              >
                NuGet
              </Link>
              <span className="h-4 w-[0.5px] bg-gray-300"></span>
              <Link
                to="https://github.com/SELISEdigitalplatforms/l0-net-blocks-construct"
                className="text-primary"
                target="_blank"
              >
                GitHub
              </Link>
              <span className="h-4 w-[0.5px] bg-gray-300"></span>
              <Link
                to="https://pypi.org/project/seliseblocks-lmt/"
                className="text-primary"
                target="_blank"
              >
                PyPI
              </Link>
            </div>
            {/* <div className="flex items-center gap-2 text-blue-700 md:justify-between">
              <Link
                to="https://github.com/SELISEdigitalplatforms/l0-net-blocks-construct"
                className="text-primary"
                target="_blank"
              >
                GitHub
              </Link>
            </div> */}
          </div>
          <div className="flex w-[50%] flex-col gap-2">
            <Button variant="outline" className="w-full" disabled>
              <img src="/assets/images/ruby-icon.png" width={20} height={20} alt={t("BLOCKS_INFO.LOGO_ALT", { name: "Ruby" })} />
            </Button>
            <p className="text-medium-emphasis">{t("BLOCKS_INFO.COMING_SOON")}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-center">{t("BLOCKS_INFO.OPEN_SOURCE")}</p>
        <Link to="https://github.com/SELISEdigitalplatforms" target="_blank">
          <Button variant="outline" className="w-full">
            <img
              src="/assets/images/social-media-github.png"
              width={20}
              height={20}
              className="mr-3"
              alt={t("BLOCKS_INFO.LOGO_ALT", { name: "GitHub" })}
            />
            {t("BLOCKS_INFO.OPEN_IN_GITHUB")}
          </Button>
        </Link>
      </div>
    </div>
  );
};
