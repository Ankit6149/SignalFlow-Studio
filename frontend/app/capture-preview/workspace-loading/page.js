import Loading from "../../loading";

export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function WorkspaceLoadingCapturePreview() {
  return <Loading />;
}
