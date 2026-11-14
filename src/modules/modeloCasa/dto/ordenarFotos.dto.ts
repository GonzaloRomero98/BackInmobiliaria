import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from "class-validator";

// Ids de todas las fotos del modelo en el orden en que se muestran.
export class OrdenarFotosDto{
    @IsArray()
    @ArrayMaxSize(100)
    @ArrayUnique()
    @IsUUID('4', {each:true})
    ids:string[];
}
