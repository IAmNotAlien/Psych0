import { getBundle, listPosts } from '@/lib/repo';
import { isStudioServer, passcodeIsDefault } from '@/lib/studio';
import { supabaseStatus } from '@/lib/supabase';
import Psych0App from '@/components/psych0/App';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const studio = await isStudioServer();
  const [bundle, drafts] = await Promise.all([
    getBundle(),
    listPosts({ includeDrafts: studio }),
  ]);
  return (
    <Psych0App
      initial={{ site: bundle.site, posts: drafts, projects: bundle.projects, embeds: bundle.embeds }}
      studio={studio}
      mode={supabaseStatus()}
      passcodeDefault={passcodeIsDefault()}
    />
  );
}
