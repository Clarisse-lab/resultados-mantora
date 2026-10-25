import Link from "next/link";

export function SemCliente({ equipe }: { equipe: boolean }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-lg font-semibold">Nenhum cliente por aqui ainda</p>
      <p className="mt-2 text-sm text-texto-3">
        {equipe ? "Cadastre o primeiro cliente e conecte as integrações para os dados começarem a chegar." : "Seu acesso ainda não foi vinculado a um cliente. Fale com a equipe Mantora."}
      </p>
      {equipe && (
        <Link href="/admin/clientes" className="botao mt-5">
          Cadastrar cliente
        </Link>
      )}
    </div>
  );
}
