import { Rocket } from 'lucide-react'
import { Card, EmptyState, KeyValueList, SkeletonLine } from './ui/primitives'
import { toFieldList } from '../lib/normalize'

const FIELD_ORDER = [
  'service',
  'app',
  'version',
  'release',
  'commit_sha',
  'sha',
  'commit',
  'branch',
  'author',
  'environment',
  'deployed_at',
  'deploy_time',
  'timestamp',
  'changelog',
  'changes',
  'rollback_to',
  'diff_url',
  'pr_url',
  'ticket',
]

/**
 * Deployment metadata around the incident window.
 * Unknown fields still render, so a backend that adds keys needs no UI change.
 */
export function DeploymentCard({ deployment, loading }) {
  const rows = toFieldList(deployment, { order: FIELD_ORDER })

  return (
    <Card title="Deployment Metadata" icon={Rocket} bodyClassName="space-y-2">
      {loading && (
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonLine key={index} className="h-4" />
          ))}
        </div>
      )}

      {!loading && !deployment && <EmptyState icon={Rocket} message="No deployment metadata returned by the backend." />}

      {!loading && deployment && rows.length === 0 && (
        <EmptyState icon={Rocket} message="Deployment metadata was returned but contained no readable fields." />
      )}

      {!loading && rows.length > 0 && <KeyValueList items={rows} />}
    </Card>
  )
}

export default DeploymentCard
