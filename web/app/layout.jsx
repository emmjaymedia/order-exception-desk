import './styles.css';

export const metadata = { title: 'Orderdesk | Purchase Order Review', description: 'Review purchase order exceptions and approve ERP-ready drafts.' };

export default function Layout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
