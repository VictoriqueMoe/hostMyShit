import { CollectionOf, Description, Name, Nullable, Property } from "@tsed/schema";
import { WaifuFile } from "./WaifuFile.js";
import { AlbumModel } from "../db/Album.model.js";
import { Builder } from "builder-pattern";

@Name("WaifuAlbum")
@Description("An album is a public collection of files, it can be shared with others in a read-only fashion")
export class AlbumDto {
    @Property()
    @Description("The token of the album")
    @Name("token")
    public token: string;

    @Property()
    @Description("The token of the bucket")
    @Name("bucketToken")
    public bucketToken: string;

    @Property()
    @Description("The public token of the album")
    @Name("publicToken")
    @Nullable(String)
    public publicToken: string | null;

    @Property()
    @Description("The name of the album")
    @Name("name")
    public name: string;

    @Property()
    @Description("The files belonging to this album")
    @Name("files")
    @CollectionOf(WaifuFile)
    public files: WaifuFile[];

    @Property()
    @Description("When the album was created")
    public dateCreated: number;

    public static fromModel(model: AlbumModel): AlbumDto {
        const fileDtos = model.files ? model.files.map(f => WaifuFile.fromModel(f, false)) : [];
        return Builder(AlbumDto)
            .token(model.albumToken)
            .bucketToken(model.bucketToken)
            .publicToken(model.publicToken)
            .name(model.name)
            .dateCreated(model.createdAt.getTime())
            .files(fileDtos)
            .build();
    }
}
