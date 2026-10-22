import { loadManuscript } from '../lib/store';
import { Manuscript } from './manuscript';

export const dynamic = 'force-dynamic';

const EditPage = () => <Manuscript initial={loadManuscript()} />;

export default EditPage;
