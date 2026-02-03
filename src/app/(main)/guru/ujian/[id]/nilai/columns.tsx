"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, CaretUpDown } from "@phosphor-icons/react"
import { format } from "date-fns"
import { id } from "date-fns/locale"

export type NilaiSubmission = {
  siswaId: string
  siswa: string
  submittedAt: string | null
  nilaiPG: number | null
  nilaiEssay: number | null
  nilaiTotal: number | null
  status: string
  jawabanEssay?: any[]
}

export const createNilaiColumns = (
  onGradeClick: (submission: NilaiSubmission) => void
): ColumnDef<NilaiSubmission>[] => [
  {
    accessorKey: "siswa",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0"
        >
          Nama Siswa
          <CaretUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("siswa")}</div>
    ),
  },
  {
    accessorKey: "submittedAt",
    header: "Tanggal Submit",
    cell: ({ row }) => {
      const date = row.getValue("submittedAt") as string | null
      if (!date) return <span className="text-muted-foreground">-</span>
      
      try {
        const parsedDate = new Date(date)
        if (isNaN(parsedDate.getTime())) {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <span className="text-sm">
            {format(parsedDate, "dd MMM yyyy HH:mm", { locale: id })}
          </span>
        )
      } catch (error) {
        return <span className="text-muted-foreground">-</span>
      }
    },
  },
  {
    accessorKey: "nilaiPG",
    header: ({ column }) => {
      return (
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0"
          >
            Nilai PG
            <CaretUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const nilai = row.getValue("nilaiPG") as number | null
      return (
        <div className="text-center font-medium">
          {nilai !== null ? nilai : "-"}
        </div>
      )
    },
  },
  {
    accessorKey: "nilaiEssay",
    header: ({ column }) => {
      return (
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0"
          >
            Nilai Essay
            <CaretUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const nilai = row.getValue("nilaiEssay") as number | null
      return (
        <div className="text-center font-medium">
          {nilai !== null ? Math.round(nilai) : "-"}
        </div>
      )
    },
  },
  {
    accessorKey: "nilaiTotal",
    header: ({ column }) => {
      return (
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0"
          >
            Nilai Total
            <CaretUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const nilai = row.getValue("nilaiTotal") as number | null
      return (
        <div className="text-center">
          {nilai !== null ? (
            <span className="font-bold text-lg text-blue-600">{nilai}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge
          variant={
            status === "sudah"
              ? "default"
              : status === "pending"
              ? "secondary"
              : "outline"
          }
          className={
            status === "sudah"
              ? "bg-green-100 text-green-700 hover:bg-green-100"
              : status === "pending"
              ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
              : ""
          }
        >
          {status === "sudah" ? "Sudah" : status === "pending" ? "Pending" : "Belum"}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => {
      const submission = row.original
      const hasEssay = submission.jawabanEssay && submission.jawabanEssay.length > 0

      if (!hasEssay || submission.status === "belum") {
        return <div className="text-right text-muted-foreground">-</div>
      }

      return (
        <div className="text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGradeClick(submission)}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {submission.status === "pending" ? "Nilai Essay" : "Lihat Nilai"}
          </Button>
        </div>
      )
    },
  },
]
